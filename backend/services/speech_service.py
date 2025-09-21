import requests
import os
import tempfile
from config import Config

class SpeechService:
    def __init__(self):
        self.api_key = Config.GHANANLP_API_KEY
        self.asr_url = "https://translation-api.ghananlp.org/asr/v1/transcribe"
        self.tts_url = "https://translation-api.ghananlp.org/tts/v1/synthesize"
        self.headers = {
            "Ocp-Apim-Subscription-Key": self.api_key
        }

    def transcribe_audio(self, audio_file_path, language="tw"):
        """Transcribe audio file to text using GhanaNLP ASR API"""
        try:
            with open(audio_file_path, 'rb') as audio_file:
                files = {'file': audio_file}
                params = {'language': language}
                response = requests.post(
                    self.asr_url,
                    headers=self.headers,
                    files=files,
                    params=params,
                    timeout=30
                )

                if response.status_code == 200:
                    # API returns plain text
                    return response.text.strip()
                else:
                    raise Exception(f"ASR API error: {response.status_code} - {response.text}")

        except Exception as e:
            raise Exception(f"ASR transcription failed: {str(e)}")

    def synthesize_text(self, text, language="tw", speaker_id="twi_speaker_4"):
        """Synthesize text to speech using GhanaNLP TTS API"""
        try:
            payload = {
                "text": text,
                "language": language,
                "speaker_id": speaker_id
            }

            response = requests.post(
                self.tts_url,
                headers={**self.headers, "Content-Type": "application/json"},
                json=payload,
                timeout=30
            )

            if response.status_code == 200:
                # Save WAV audio to temp file
                with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                    temp_file.write(response.content)
                    return temp_file.name
            else:
                raise Exception(f"TTS API error: {response.status_code} - {response.text}")

        except Exception as e:
            raise Exception(f"TTS synthesis failed: {str(e)}")

# Factory function
def create_speech_service():
    """Factory function to create SpeechService instance"""
    return SpeechService()