#!/usr/bin/env python3
"""
Test script for Hugging Face model integration.
This script tests loading the FelixYaw/twi-gpt-lora-kaggle model and generating responses.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.huggingface_service import create_huggingface_service

def test_model_loading():
    """Test loading the Hugging Face model"""
    print("Testing Hugging Face model loading...")

    try:
        service = create_huggingface_service()
        models = service.get_available_models()
        print(f"Available models: {list(models.keys())}")

        model_name = "FelixYaw/twi-gpt-lora-kaggle"
        if service.is_model_available(model_name):
            print(f"✓ Model {model_name} is available")
        else:
            print(f"✗ Model {model_name} is not available")
            return False

        return True
    except Exception as e:
        print(f"✗ Error loading model: {e}")
        return False

def test_model_generation():
    """Test generating text with the model"""
    print("\nTesting text generation...")

    try:
        service = create_huggingface_service()
        model_name = "FelixYaw/twi-gpt-lora-kaggle"

        # Test messages
        messages = [
            {"role": "user", "content": "Hello, how are you?"}
        ]

        print("Generating response...")
        response = service.chat_complete(model_name, messages)
        print(f"Response: {response}")

        if response and len(response.strip()) > 0:
            print("✓ Text generation successful")
            return True
        else:
            print("✗ Empty response generated")
            return False

    except Exception as e:
        print(f"✗ Error generating text: {e}")
        return False

def test_streaming_generation():
    """Test streaming text generation"""
    print("\nTesting streaming text generation...")

    try:
        service = create_huggingface_service()
        model_name = "FelixYaw/twi-gpt-lora-kaggle"

        messages = [
            {"role": "user", "content": "Tell me a short story."}
        ]

        print("Streaming response:")
        chunks = []
        for chunk in service.chat_stream(model_name, messages):
            print(chunk, end="", flush=True)
            chunks.append(chunk)

        response = ''.join(chunks)
        print(f"\n\nFull response: {response}")

        if response and len(response.strip()) > 0:
            print("✓ Streaming generation successful")
            return True
        else:
            print("✗ Empty streaming response")
            return False

    except Exception as e:
        print(f"✗ Error in streaming: {e}")
        return False

def main():
    """Run all tests"""
    print("=== Hugging Face Model Test ===\n")

    # Test 1: Model loading
    if not test_model_loading():
        print("\nModel loading failed. Exiting.")
        return 1

    # Test 2: Text generation
    if not test_model_generation():
        print("\nText generation failed. Exiting.")
        return 1

    # Test 3: Streaming generation
    if not test_streaming_generation():
        print("\nStreaming generation failed. Exiting.")
        return 1

    print("\n=== All tests passed! ===")
    return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)