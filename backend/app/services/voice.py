import os
import io

class VoiceService:
    def __init__(self):
        # Whisper model is loaded lazily on first transcription call
        # to avoid loading PyTorch (~700MB) at server startup on Render free tier
        self._stt_model = None

    def _get_stt_model(self):
        if self._stt_model is None:
            try:
                import whisper  # noqa: lazy import — keep off critical path
                self._stt_model = whisper.load_model("base")
            except ImportError:
                raise RuntimeError(
                    "openai-whisper is not installed. Audio transcription is unavailable."
                )
        return self._stt_model

    def transcribe(self, audio_path: str) -> str:
        model = self._get_stt_model()
        result = model.transcribe(audio_path)
        return result["text"]

    def text_to_speech(self, text: str, output_path: str = "response_audio.mp3"):
        from gtts import gTTS  # noqa: lazy import
        tts = gTTS(text=text, lang='en')
        tts.save(output_path)
        return output_path

voice_service = VoiceService()

