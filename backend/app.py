from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from database import db, FineTuneData
from config import Config
from routes.auth import auth_bp
from routes.chat import chat_bp
from routes.models import models_bp
from routes.admin import admin_bp
import threading
import logging

logger = logging.getLogger(__name__)

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize extensions
    db.init_app(app)
    jwt = JWTManager(app)
    CORS(app, origins=["http://localhost:5175"])  # Vite dev server
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(chat_bp, url_prefix='/api/chat')
    app.register_blueprint(models_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    
    # Create tables
    with app.app_context():
        # Drop tables to handle schema changes (dev only)
        # db.drop_all()
        db.create_all()

    # Start background model pre-loading if configured
    if Config.PRELOAD_HF_MODELS:
        def start_preloading():
            with app.app_context():
                from services.huggingface_service import create_huggingface_service
                hf_service = create_huggingface_service()
                logger.info(f"Starting pre-loading of models: {Config.PRELOAD_HF_MODELS}")
                hf_service.preload_models(Config.PRELOAD_HF_MODELS)

        # Start pre-loading in background thread
        preload_thread = threading.Thread(target=start_preloading, daemon=True)
        preload_thread.start()

    @app.route('/api/health')
    def health_check():
        from services.huggingface_service import create_huggingface_service
        hf_service = create_huggingface_service()
        model_status = hf_service.get_loading_status()

        return {
            "status": "healthy",
            "message": "Ollama Chatbot API is running",
            "model_loading_status": model_status
        }

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=3030)
