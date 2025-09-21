import librosa
from transformers import WhisperForConditionalGeneration, WhisperProcessor
import tempfile
import os
import requests  # Keep for TTS
from config import Config

class SpeechService:
    def __init__(self):
        # Keep TTS API config
        self.api_key = Config.GHANANLP_API_KEY
        self.tts_url = "https://translation-api.ghananlp.org/tts/v1/synthesize"
        self.headers = {
            "Ocp-Apim-Subscription-Key": self.api_key
        }

        # New: Load Whisper model and processor for ASR
        self.model = None
        self.processor = None
        self._load_whisper_model()

    def _load_whisper_model(self):
        """Lazy-load the Whisper model to avoid startup delays."""
        if self.model is None:
            print("Loading Whisper ASR model...")
            self.model = WhisperForConditionalGeneration.from_pretrained("GiftMark/akan-whisper-model")
            self.processor = WhisperProcessor.from_pretrained("GiftMark/akan-whisper-model")
            print("Whisper model loaded.")

    def transcribe_audio(self, audio_file_path, language="tw"):
        """Transcribe audio file to text using Hugging Face Whisper model"""
        try:
            # Load audio into array (Librosa handles MP3/WAV, resamples to 16kHz)
            audio_array, sr = librosa.load(audio_file_path, sr=16000)

            # Process with Whisper
            inputs = self.processor(audio_array, sampling_rate=16000, return_tensors="pt").input_features

            # Generate transcription (language can be specified if needed, but model is Akan-tuned)
            # predicted_ids = self.model.generate(inputs, language=language if language else None)
            predicted_ids = self.model.generate(inputs)

            transcription = self.processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]

            return transcription.strip()

        except Exception as e:
            raise Exception(f"ASR transcription failed: {str(e)}")

    # TTS method remains unchanged
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