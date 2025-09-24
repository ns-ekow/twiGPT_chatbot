import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-change-in-production'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///chatbot.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-secret-change-in-production'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    OLLAMA_BASE_URL = 'http://localhost:11434'
    GHANANLP_API_KEY = os.environ.get('GHANANLP_API_KEY') or 'your-ghananlp-api-key-here'
    # HuggingFace model pre-loading configuration
    PRELOAD_HF_MODELS = [
        "FelixYaw/twi-lora-model",
        "FelixYaw/twi-gpt-lora-kaggle"
    ]  # Empty list disables pre-loading