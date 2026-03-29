import os
import whisper
from gtts import gTTS
import io
from app.core.config import settings

class VoiceService:
    def __init__(self):
        # Local Whisper model (could be API based too)
        self.stt_model = whisper.load_model("base")

    def transcribe(self, audio_path: str) -> str:
        result = self.stt_model.transcribe(audio_path)
        return result["text"]

    def text_to_speech(self, text: str, output_path: str = "response_audio.mp3"):
        # Using gTTS as fallback/primary for simplicity unless OpenAI key is provided
        tts = gTTS(text=text, lang='en')
        tts.save(output_path)
        return output_path

voice_service = VoiceService()
