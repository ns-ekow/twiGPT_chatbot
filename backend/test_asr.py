#!/usr/bin/env python3
"""Test script for ASR service"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from services.speech_service import create_speech_service
import tempfile
import numpy as np
import soundfile as sf

def create_test_audio():
    """Create a simple test audio file with a beep (not speech, but for testing loading)"""
    # Generate a 1-second sine wave at 440 Hz
    sample_rate = 16000
    duration = 1.0
    frequency = 440.0
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    audio = np.sin(frequency * 2 * np.pi * t)

    # Save as WAV
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
        sf.write(temp_file.name, audio, sample_rate)
        return temp_file.name

def test_asr():
    print("Testing ASR service...")

    # Create test audio
    audio_path = create_test_audio()
    print(f"Created test audio: {audio_path}")

    try:
        # Create service
        service = create_speech_service()
        print("Service created successfully")

        # Test transcription
        result = service.transcribe_audio(audio_path, language="en")
        print(f"Transcription result: '{result}'")

        print("ASR test completed successfully!")

    except Exception as e:
        print(f"ASR test failed: {e}")
        return False

    finally:
        # Clean up
        if os.path.exists(audio_path):
            os.unlink(audio_path)

    return True

if __name__ == "__main__":
    success = test_asr()
    sys.exit(0 if success else 1)