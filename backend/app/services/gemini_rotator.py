import time
import threading
from typing import Optional, Generator, List
from google import genai
from google.genai import types
from app.core.config import settings

MAX_RETRIES = 2       # retries per model before falling back to next model
RETRY_DELAY = 1       # seconds between retries on 503

# Ordered fallback chain — 2.5-flash first, then progressively lighter models
MODEL_FALLBACK_CHAIN = [
    "gemini-2.5-flash",          # Latest & most capable flash model
    "gemini-2.0-flash",          # Fast fallback with higher rate limits
    "gemini-1.5-flash",          # Reliable stable fallback
    "gemini-2.0-flash-lite",     # Lightest emergency fallback
]

def _build_config(temperature: float, max_output_tokens: int) -> types.GenerateContentConfig:
    """Return a fast GenerateContentConfig with minimal first-token latency."""
    # NOTE: Do NOT use ThinkingConfig — it adds 10-30s overhead even with budget=0
    # on gemini-2.5-flash. gemini-2.0-flash has no thinking mode.
    return types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )

class APIKeysExhaustedError(Exception):
    """Raised when all configured Gemini API keys are exhausted due to rate limits (429 / ResourceExhausted)."""
    pass

class GeminiKeyManager:
    """
    Thread-safe & high-performance API Key Manager for Gemini LLM calls using native google.genai SDK.
    - Round-robin load balances requests across ALL configured API keys (primary, secondary, and pool).
    - Per-key rate-limit tracking: On 429 / ResourceExhausted errors, puts only the offending key on a
      cooldown timer and instantly switches to the next healthy key in the pool.
    - Eliminates rate-limit delays and maximizes throughput across multiple free/paid keys.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self.cooldown_duration: float = float(settings.GEMINI_COOLDOWN_SECONDS)
        self.keys: List[str] = []
        self.key_cooldowns: dict[str, float] = {}  # key -> cooldown_until_timestamp
        self._rr_index: int = 0
        self._client_cache: dict[str, genai.Client] = {}
        self.reload_keys()

    def reload_keys(self, primary: Optional[str] = None, secondary: Optional[str] = None):
        with self._lock:
            pool = []
            pk = primary.strip() if primary is not None else settings.get_primary_key()
            sk = secondary.strip() if secondary is not None else settings.get_secondary_key()

            if pk: pool.append(pk)
            if sk and sk not in pool: pool.append(sk)

            # Include any extra keys from GEMINI_API_KEYS
            if settings.GEMINI_API_KEYS_RAW.strip():
                for k in settings.GEMINI_API_KEYS_RAW.split(","):
                    k = k.strip()
                    if k and k not in pool:
                        pool.append(k)

            self.keys = pool
            self.key_cooldowns = {k: 0.0 for k in pool}
            self._client_cache.clear()
            self._rr_index = 0

    def mark_key_cooldown(self, key: str):
        with self._lock:
            self.key_cooldowns[key] = time.time() + self.cooldown_duration
            print(f"[GEMINI API MANAGER] Key {key[:6]}... rate limited (429). Put on {int(self.cooldown_duration)}s cooldown.")

    def get_active_key(self) -> tuple[str, str]:
        """
        Returns (key_string, role_name) using Round-Robin across non-cooldown keys.
        """
        with self._lock:
            if not self.keys:
                pk = settings.get_primary_key()
                return pk, "PRIMARY"

            now = time.time()
            healthy_keys = [k for k in self.keys if now >= self.key_cooldowns.get(k, 0.0)]

            if healthy_keys:
                self._rr_index = self._rr_index % len(healthy_keys)
                selected_key = healthy_keys[self._rr_index]
                self._rr_index = (self._rr_index + 1) % len(healthy_keys)
                role = "PRIMARY" if selected_key == self.keys[0] else "SECONDARY"
                return selected_key, role

            # If all keys are on cooldown, return the one whose cooldown expires soonest
            soonest_key = min(self.keys, key=lambda k: self.key_cooldowns.get(k, 0.0))
            return soonest_key, "FALLBACK"

    def is_rate_limit_error(self, e: Exception) -> bool:
        err_msg = str(e).lower()
        return any(term in err_msg for term in ["429", "resource_exhausted", "resourceexhausted", "quota", "rate limit"])

    def is_unavailable_error(self, e: Exception) -> bool:
        err_msg = str(e).lower()
        return any(term in err_msg for term in ["503", "unavailable", "404", "not_found", "not found", "no longer available"])

    def _get_cached_client(self, key: str) -> genai.Client:
        if key not in self._client_cache:
            self._client_cache[key] = genai.Client(api_key=key)
        return self._client_cache[key]

    def invoke_with_fallback(
        self,
        prompt: str,
        temperature: float = 0.5,
        max_output_tokens: int = 4096,
        model_name: Optional[str] = None
    ) -> str:
        requested = model_name or settings.GEMINI_MODEL
        model_chain = [requested] + [m for m in MODEL_FALLBACK_CHAIN if m != requested]

        with self._lock:
            available_keys = [k for k in self.keys if time.time() >= self.key_cooldowns.get(k, 0.0)]
            if not available_keys:
                available_keys = list(self.keys)

        for target_model in model_chain:
            for active_key in available_keys:
                config = _build_config(temperature, max_output_tokens)
                try:
                    client = self._get_cached_client(active_key)
                    response = client.models.generate_content(
                        model=target_model,
                        contents=prompt,
                        config=config,
                    )
                    return response.text or ""
                except Exception as e:
                    if self.is_rate_limit_error(e):
                        self.mark_key_cooldown(active_key)
                        continue
                    if self.is_unavailable_error(e):
                        continue
                    raise e

        raise APIKeysExhaustedError("All Gemini API keys are currently exhausted or rate limited.")

    def stream_with_fallback(
        self,
        prompt: str,
        temperature: float = 0.5,
        max_output_tokens: int = 4096,
        model_name: Optional[str] = None
    ) -> Generator[str, None, None]:
        requested = model_name or settings.GEMINI_MODEL
        model_chain = [requested] + [m for m in MODEL_FALLBACK_CHAIN if m != requested]

        # Gather currently healthy keys for this streaming attempt
        with self._lock:
            healthy_keys = [k for k in self.keys if time.time() >= self.key_cooldowns.get(k, 0.0)]
            if not healthy_keys:
                healthy_keys = list(self.keys) if self.keys else [settings.get_primary_key()]

        config = _build_config(temperature, max_output_tokens)

        for target_model in model_chain:
            for active_key in healthy_keys:
                try:
                    client = self._get_cached_client(active_key)
                    res_stream = client.models.generate_content_stream(
                        model=target_model,
                        contents=prompt,
                        config=config,
                    )
                    yielded_any = False
                    for chunk in res_stream:
                        text_piece = ""
                        try:
                            text_piece = chunk.text or ""
                        except (ValueError, AttributeError):
                            if hasattr(chunk, "candidates") and chunk.candidates:
                                for cand in chunk.candidates:
                                    if hasattr(cand, "content") and cand.content and hasattr(cand.content, "parts"):
                                        for part in cand.content.parts:
                                            if hasattr(part, "text") and part.text:
                                                text_piece += part.text
                        if text_piece:
                            yielded_any = True
                            yield text_piece

                    if not yielded_any:
                        full_resp = client.models.generate_content(
                            model=target_model,
                            contents=prompt,
                            config=config,
                        )
                        if full_resp and full_resp.text:
                            yield full_resp.text
                    return  # Streaming completed successfully

                except Exception as e:
                    if self.is_rate_limit_error(e):
                        self.mark_key_cooldown(active_key)
                        print(f"[GEMINI API MANAGER] Key {active_key[:6]}... rate limited during stream. Retrying next available key...")
                        continue
                    if self.is_unavailable_error(e):
                        print(f"[GEMINI API MANAGER] Model {target_model} unavailable. Trying next...")
                        break  # try next model in model_chain

        raise APIKeysExhaustedError("All Gemini API keys are currently rate limited (429).")

    def get_status(self) -> dict:
        with self._lock:
            now = time.time()

            def mask_key(k: str) -> str:
                return (k[:6] + "..." + k[-4:]) if len(k) > 10 else ("Configured" if k else "Not set")

            healthy_count = sum(1 for k in self.keys if now >= self.key_cooldowns.get(k, 0.0))

            # Compute active key inline — do NOT call self.get_active_key() here
            # because that method also acquires self._lock → deadlock.
            healthy_keys = [k for k in self.keys if now >= self.key_cooldowns.get(k, 0.0)]
            if healthy_keys:
                idx = self._rr_index % len(healthy_keys)
                active_key = healthy_keys[idx]
                active_role = "PRIMARY" if (self.keys and active_key == self.keys[0]) else "SECONDARY"
            elif self.keys:
                active_key = min(self.keys, key=lambda k: self.key_cooldowns.get(k, 0.0))
                active_role = "FALLBACK"
            else:
                active_key = settings.get_primary_key()
                active_role = "PRIMARY"

            return {
                "total_keys": len(self.keys),
                "healthy_keys": healthy_count,
                "active_key_role": active_role,
                "active_key_masked": mask_key(active_key),
                "current_model": settings.GEMINI_MODEL
            }

gemini_key_manager = GeminiKeyManager()
