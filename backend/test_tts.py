#!/usr/bin/env python3
"""Test script for TTS service"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.speech_service import create_speech_service
import tempfile

def test_tts():
    print("Testing TTS service...")

    try:
        # Create service
        service = create_speech_service()
        print("Service created successfully")

        # Test synthesis
        text = "Nanso, ɛberɛ a mesuntiiɛ no, wɔde anigyeɛ boaa wɔn ho ano; ntohyɛsofoɔ twaa me ho hyiaaɛ a mennim na wɔdii me ho nsekuro a wɔantwa so da"
        print(f"Synthesizing text: '{text}'")

        audio_path = service.synthesize_text(text)
        print(f"Audio saved to: {audio_path}")

        # Check if file exists and has content
        if os.path.exists(audio_path) and os.path.getsize(audio_path) > 0:
            print("✓ TTS test successful!")
            print(f"Audio file size: {os.path.getsize(audio_path)} bytes")
        else:
            print("✗ Audio file not created or empty")
            return False

    except Exception as e:
        print(f"✗ TTS test failed: {e}")
        return False

    finally:
        # Don't clean up cached files - they should persist
        # Only clean up if it's a temp file (not in cache directory)
        if 'audio_path' in locals() and os.path.exists(audio_path):
            if not audio_path.startswith(os.path.join(os.getcwd(), 'tts_cache')):
                os.unlink(audio_path)
                print("Cleaned up temp audio file")
            else:
                print("Kept cached audio file")

    return True

if __name__ == "__main__":
    success = test_tts()
    sys.exit(0 if success else 1)