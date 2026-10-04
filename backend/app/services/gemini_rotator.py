import time
import threading
from typing import Optional, Generator
from google import genai
from google.genai import types
from app.core.config import settings

MAX_RETRIES = 2       # retries per model before falling back to next model
RETRY_DELAY = 1       # seconds between retries on 503

# Ordered fallback chain — when one model hits 503, the next is tried automatically
MODEL_FALLBACK_CHAIN = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
]

# ── Detect ThinkingConfig support once at startup ──────────────────────────────
# ThinkingConfig.budget_tokens was added in google-genai 0.8.x.
# We probe it once here so we never double-call the API at runtime.
def _build_config(temperature: float, max_output_tokens: int) -> types.GenerateContentConfig:
    """Return a GenerateContentConfig, with thinking disabled if the SDK supports it."""
    try:
        return types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            thinking_config=types.ThinkingConfig(budget_tokens=0),
        )
    except Exception:
        # SDK too old to support budget_tokens — use plain config
        return types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )

class APIKeysExhaustedError(Exception):
    """Raised when all configured Gemini API keys are exhausted due to rate limits (429 / ResourceExhausted)."""
    pass

class GeminiKeyManager:
    """
    Thread-safe & async-compatible API Key Manager for Gemini LLM calls using native google.genai SDK.
    - Defaults to GEMINI_PRIMARY_KEY.
    - On 429 / ResourceExhausted errors, instantly triggers a 60-second cooldown for Primary
      and switches execution to GEMINI_SECONDARY_KEY.
    - Automatically resumes using GEMINI_PRIMARY_KEY once the 60-second cooldown timer expires.
    - Raises APIKeysExhaustedError if both keys are exhausted simultaneously.
    """
    def __init__(self):
        self.primary_key: str = settings.get_primary_key()
        self.secondary_key: str = settings.get_secondary_key()
        self.primary_cooldown_until: float = 0.0
        self.cooldown_duration: float = float(settings.GEMINI_COOLDOWN_SECONDS)
        self._lock = threading.Lock()
        self._client_cache: dict = {}  # Cache genai.Client instances per API key

    def reload_keys(self, primary: Optional[str] = None, secondary: Optional[str] = None):
        with self._lock:
            if primary is not None:
                self.primary_key = primary.strip()
            else:
                self.primary_key = settings.get_primary_key()

            if secondary is not None:
                self.secondary_key = secondary.strip()
            else:
                self.secondary_key = settings.get_secondary_key()
            self.primary_cooldown_until = 0.0
            self._client_cache.clear()

    def is_primary_on_cooldown(self) -> bool:
        with self._lock:
            return time.time() < self.primary_cooldown_until

    def mark_primary_cooldown(self):
        with self._lock:
            self.primary_cooldown_until = time.time() + self.cooldown_duration
            print(f"[GEMINI API MANAGER] Primary API key rate limited (429 / ResourceExhausted). Initiating {int(self.cooldown_duration)}s cooldown. Switching to Secondary key.")

    def get_active_key(self) -> tuple[str, str]:
        """
        Returns (key_string, role_name)
        role_name is 'PRIMARY' or 'SECONDARY'
        """
        with self._lock:
            now = time.time()
            if now >= self.primary_cooldown_until:
                if self.primary_key:
                    return self.primary_key, "PRIMARY"
            if self.secondary_key:
                return self.secondary_key, "SECONDARY"
            return self.primary_key, "PRIMARY"

    def is_rate_limit_error(self, e: Exception) -> bool:
        err_msg = str(e).lower()
        return any(term in err_msg for term in ["429", "resource_exhausted", "resourceexhausted", "quota", "rate limit"])

    def is_unavailable_error(self, e: Exception) -> bool:
        err_msg = str(e).lower()
        return "503" in err_msg or "unavailable" in err_msg

    def _get_cached_client(self, key: str) -> genai.Client:
        """Return a cached google.genai.Client instance."""
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
        """
        Invokes LLM with automatic Primary -> Secondary key failover on 429 errors.
        On 503 UNAVAILABLE, walks through MODEL_FALLBACK_CHAIN until one succeeds.
        """
        active_key, role = self.get_active_key()
        config = _build_config(temperature, max_output_tokens)

        # Build the model list to try: requested model first, then rest of fallback chain
        requested = model_name or settings.GEMINI_MODEL
        model_chain = [requested] + [m for m in MODEL_FALLBACK_CHAIN if m != requested]

        for target_model in model_chain:
            for attempt in range(MAX_RETRIES):
                try:
                    client = self._get_cached_client(active_key)
                    response = client.models.generate_content(
                        model=target_model,
                        contents=prompt,
                        config=config,
                    )
                    if target_model != requested:
                        print(f"[GEMINI API MANAGER] Using fallback model: {target_model}")
                    return response.text or ""
                except Exception as e:
                    if self.is_unavailable_error(e):
                        if attempt < MAX_RETRIES - 1:
                            print(f"[GEMINI API MANAGER] 503 on {target_model} attempt {attempt+1}/{MAX_RETRIES}. Retrying in {RETRY_DELAY}s...")
                            time.sleep(RETRY_DELAY)
                            continue
                        else:
                            print(f"[GEMINI API MANAGER] 503 on {target_model} — trying next model in chain.")
                            break  # try next model
                    if self.is_rate_limit_error(e):
                        if role == "PRIMARY":
                            self.mark_primary_cooldown()
                            if self.secondary_key:
                                print("[GEMINI API MANAGER] Retrying request immediately with Secondary API Key...")
                                try:
                                    client_sec = self._get_cached_client(self.secondary_key)
                                    response = client_sec.models.generate_content(
                                        model=target_model,
                                        contents=prompt,
                                        config=config,
                                    )
                                    return response.text or ""
                                except Exception as sec_e:
                                    if self.is_rate_limit_error(sec_e):
                                        raise APIKeysExhaustedError("All Gemini API keys exhausted (429 / ResourceExhausted). Both Primary and Secondary keys are rate limited.") from sec_e
                                    raise sec_e
                            else:
                                raise APIKeysExhaustedError("GEMINI_PRIMARY_KEY rate limited (429) and no GEMINI_SECONDARY_KEY configured.") from e
                        else:
                            raise APIKeysExhaustedError("All Gemini API keys exhausted (429 / ResourceExhausted). Primary key in cooldown and Secondary key rate limited.") from e
                    raise e
        raise RuntimeError(f"All models in fallback chain returned 503 UNAVAILABLE: {model_chain}")

    def stream_with_fallback(
        self,
        prompt: str,
        temperature: float = 0.5,
        max_output_tokens: int = 4096,
        model_name: Optional[str] = None
    ) -> Generator[str, None, None]:
        """
        Streams LLM response chunk by chunk with automatic key failover and 503 retry logic.
        On 503 UNAVAILABLE, walks through MODEL_FALLBACK_CHAIN until one succeeds.
        """
        active_key, role = self.get_active_key()
        config = _build_config(temperature, max_output_tokens)

        requested = model_name or settings.GEMINI_MODEL
        model_chain = [requested] + [m for m in MODEL_FALLBACK_CHAIN if m != requested]

        for target_model in model_chain:
            for attempt in range(MAX_RETRIES):
                try:
                    client = self._get_cached_client(active_key)
                    res_stream = client.models.generate_content_stream(
                        model=target_model,
                        contents=prompt,
                        config=config,
                    )
                    if target_model != requested:
                        print(f"[GEMINI API MANAGER] Streaming with fallback model: {target_model}")
                    for chunk in res_stream:
                        if chunk.text:
                            yield chunk.text
                    return  # success
                except Exception as e:
                    if self.is_unavailable_error(e):
                        if attempt < MAX_RETRIES - 1:
                            print(f"[GEMINI API MANAGER] 503 on {target_model} stream attempt {attempt+1}/{MAX_RETRIES}. Retrying in {RETRY_DELAY}s...")
                            time.sleep(RETRY_DELAY)
                            continue
                        else:
                            print(f"[GEMINI API MANAGER] 503 on {target_model} stream — trying next model.")
                            break  # try next model
                    if self.is_rate_limit_error(e):
                        if role == "PRIMARY":
                            self.mark_primary_cooldown()
                            if self.secondary_key:
                                print("[GEMINI API MANAGER] Retrying streaming request with Secondary API Key...")
                                try:
                                    client_sec = self._get_cached_client(self.secondary_key)
                                    res_stream = client_sec.models.generate_content_stream(
                                        model=target_model,
                                        contents=prompt,
                                        config=config,
                                    )
                                    for chunk in res_stream:
                                        if chunk.text:
                                            yield chunk.text
                                    return
                                except Exception as sec_e:
                                    if self.is_rate_limit_error(sec_e):
                                        raise APIKeysExhaustedError("All Gemini API keys exhausted (429 / ResourceExhausted).") from sec_e
                                    raise sec_e
                            else:
                                raise APIKeysExhaustedError("GEMINI_PRIMARY_KEY rate limited (429) and no GEMINI_SECONDARY_KEY configured.") from e
                        else:
                            raise APIKeysExhaustedError("All Gemini API keys exhausted (429 / ResourceExhausted). Primary key in cooldown and Secondary key rate limited.") from e
                    raise e
        raise RuntimeError(f"All models in fallback chain returned 503 UNAVAILABLE: {model_chain}")


    def get_status(self) -> dict:
        with self._lock:
            now = time.time()
            on_cooldown = now < self.primary_cooldown_until
            remaining_cooldown = max(0.0, round(self.primary_cooldown_until - now, 1)) if on_cooldown else 0.0
            active_key, active_role = self.get_active_key()
            
            def mask_key(k: str) -> str:
                return (k[:6] + "..." + k[-4:]) if len(k) > 10 else ("Configured" if k else "Not set")

            return {
                "primary_key_status": f"Cooldown ({remaining_cooldown}s remaining)" if on_cooldown else "Active",
                "secondary_key_status": "Active" if self.secondary_key else "Not configured",
                "active_key_role": active_role,
                "active_key_masked": mask_key(active_key),
                "cooldown_remaining_seconds": remaining_cooldown,
                "current_model": settings.GEMINI_MODEL
            }

gemini_key_manager = GeminiKeyManager()
