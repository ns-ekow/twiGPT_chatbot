import librosa
from transformers import WhisperForConditionalGeneration, WhisperProcessor
import tempfile
import os
import hashlib
from gradio_client import Client

class SpeechService:
    def __init__(self):
        # TTS client
        self.tts_client = Client("Ghana-NLP/Southern-Ghana-TTS-Public")

        # TTS cache directory
        self.tts_cache_dir = os.path.join(os.getcwd(), 'tts_cache')
        os.makedirs(self.tts_cache_dir, exist_ok=True)

        # New: Load Whisper model and processor for ASR
        self.model = None
        self.processor = None
        self._load_whisper_model()

    def _get_cache_key(self, text, language, speaker_id):
        """Generate a unique cache key for TTS requests"""
        # Create a hash of the input parameters
        cache_string = f"{text}|{language}|{speaker_id}"
        return hashlib.md5(cache_string.encode('utf-8')).hexdigest() + '.wav'

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

    def synthesize_text(self, text, language="tw", speaker_id="twi_speaker_4"):
        """Synthesize text to speech using Ghana-NLP Southern Ghana TTS API"""
        try:
            # Generate cache key
            cache_key = self._get_cache_key(text, language, speaker_id)
            cache_path = os.path.join(self.tts_cache_dir, cache_key)

            # Check if cached file exists
            if os.path.exists(cache_path):
                print(f"[TTS Cache] Using cached audio: {cache_path}")
                return cache_path

            # Map parameters to new API
            lang = "Asante Twi"  # Default language mapping
            speaker = "Female"   # Default speaker mapping

            print(f"[TTS Cache] Generating new audio for: '{text[:50]}...'")

            result = self.tts_client.predict(
                text=text,
                lang=lang,
                speaker=speaker,
                api_name="/predict"
            )

            # Result is a file path to the audio file
            if isinstance(result, str) and os.path.exists(result):
                # Read the audio file and save to cache
                with open(result, 'rb') as audio_file:
                    audio_bytes = audio_file.read()

                # Save to cache
                with open(cache_path, 'wb') as cache_file:
                    cache_file.write(audio_bytes)

                print(f"[TTS Cache] Saved to cache: {cache_path}")
                return cache_path
            else:
                raise Exception(f"Unexpected result from TTS API: {result}")

        except Exception as e:
            raise Exception(f"TTS synthesis failed: {str(e)}")

# Factory function
def create_speech_service():
    """Factory function to create SpeechService instance"""
    return SpeechService()