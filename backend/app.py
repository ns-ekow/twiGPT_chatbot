from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from database import db
from config import Config
from routes.auth import auth_bp
from routes.chat import chat_bp
from routes.models import models_bp

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
    
    # Create tables
    with app.app_context():
        db.create_all()
    
    @app.route('/api/health')
    def health_check():
        return {"status": "healthy", "message": "Ollama Chatbot API is running"}
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=3030)
