# Complete Ollama Chatbot Project Guide

## Project Structure

```
ollama-chatbot/
├── backend/
│   ├── app.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── conversation.py
│   │   └── message.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── ollama_service.py
│   │   └── auth_service.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── chat.py
│   │   └── models.py
│   ├── database.py
│   ├── config.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat/
│   │   │   ├── Sidebar/
│   │   │   ├── Auth/
│   │   │   └── Common/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── context/
│   │   └── utils/
│   ├── package.json
│   └── ...
└── README.md
```

## Phase 1: Backend Setup

### 1. Initialize Backend Environment

```bash
mkdir ollama-chatbot
cd ollama-chatbot
mkdir backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install flask flask-cors flask-jwt-extended flask-sqlalchemy bcrypt requests python-dotenv
pip freeze > requirements.txt
```

### 2. Backend Configuration (`config.py`)

```python
import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-change-in-production'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///chatbot.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-secret-change-in-production'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    OLLAMA_BASE_URL = 'http://localhost:11434'
```

### 3. Database Models (`database.py`)

```python
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    conversations = db.relationship('Conversation', backref='user', lazy=True, cascade='all, delete-orphan')

class Conversation(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(200), nullable=False, default='New Conversation')
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    model_name = db.Column(db.String(50), nullable=False, default='llama3.1:8b')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    messages = db.relationship('Message', backref='conversation', lazy=True, cascade='all, delete-orphan')

class Message(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = db.Column(db.String(36), db.ForeignKey('conversation.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
```

### 4. Ollama Service (`services/ollama_service.py`)

```python
import requests
import json
from typing import Generator, Dict, Any, List
from config import Config

class OllamaService:
    def __init__(self):
        self.base_url = Config.OLLAMA_BASE_URL
        self.available_models = {}
        self._load_available_models()
    
    def _load_available_models(self):
        """Load available models from Ollama"""
        try:
            response = requests.get(f"{self.base_url}/api/tags")
            if response.status_code == 200:
                models_data = response.json()
                for model in models_data.get('models', []):
                    name = model['name']
                    self.available_models[name] = {
                        'name': name,
                        'size': model.get('size', 0),
                        'modified_at': model.get('modified_at', ''),
                        'details': model.get('details', {})
                    }
        except Exception as e:
            print(f"Error loading models: {e}")
    
    def get_available_models(self) -> Dict[str, Any]:
        """Get list of available models"""
        self._load_available_models()  # Refresh models list
        return self.available_models
    
    def chat_stream(self, model: str, messages: List[Dict[str, str]], 
                   system_message: str = None) -> Generator[str, None, None]:
        """Stream chat completion from Ollama"""
        
        # Prepare messages for Ollama format
        ollama_messages = []
        
        if system_message:
            ollama_messages.append({"role": "system", "content": system_message})
        
        for msg in messages:
            ollama_messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        payload = {
            "model": model,
            "messages": ollama_messages,
            "stream": True,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
                "top_k": 40
            }
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/api/chat",
                json=payload,
                stream=True,
                timeout=60
            )
            
            if response.status_code != 200:
                yield f"Error: {response.status_code} - {response.text}"
                return
            
            for line in response.iter_lines():
                if line:
                    try:
                        chunk = json.loads(line.decode('utf-8'))
                        if 'message' in chunk and 'content' in chunk['message']:
                            content = chunk['message']['content']
                            if content:
                                yield content
                        
                        if chunk.get('done', False):
                            break
                            
                    except json.JSONDecodeError:
                        continue
                        
        except requests.exceptions.RequestException as e:
            yield f"Error connecting to Ollama: {str(e)}"
    
    def chat_complete(self, model: str, messages: List[Dict[str, str]], 
                     system_message: str = None) -> str:
        """Get complete chat response from Ollama"""
        response_parts = []
        for chunk in self.chat_stream(model, messages, system_message):
            response_parts.append(chunk)
        return ''.join(response_parts)
    
    def is_model_available(self, model_name: str) -> bool:
        """Check if a model is available"""
        return model_name in self.available_models
    
    def pull_model(self, model_name: str) -> bool:
        """Pull a model from Ollama registry"""
        try:
            payload = {"name": model_name}
            response = requests.post(f"{self.base_url}/api/pull", json=payload)
            return response.status_code == 200
        except Exception as e:
            print(f"Error pulling model {model_name}: {e}")
            return False

# Model factory function
def create_ollama_service() -> OllamaService:
    """Factory function to create OllamaService instance"""
    return OllamaService()
```

### 5. Authentication Service (`services/auth_service.py`)

```python
import bcrypt
from flask_jwt_extended import create_access_token
from database import db, User

class AuthService:
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password"""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        """Verify a password against its hash"""
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    
    @staticmethod
    def register_user(username: str, email: str, password: str) -> dict:
        """Register a new user"""
        if User.query.filter_by(username=username).first():
            return {"error": "Username already exists"}
        
        if User.query.filter_by(email=email).first():
            return {"error": "Email already exists"}
        
        password_hash = AuthService.hash_password(password)
        user = User(username=username, email=email, password_hash=password_hash)
        
        db.session.add(user)
        db.session.commit()
        
        token = create_access_token(identity=user.id)
        return {
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email
            },
            "token": token
        }
    
    @staticmethod
    def login_user(username: str, password: str) -> dict:
        """Login a user"""
        user = User.query.filter_by(username=username).first()
        
        if not user or not AuthService.verify_password(password, user.password_hash):
            return {"error": "Invalid credentials"}
        
        token = create_access_token(identity=user.id)
        return {
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email
            },
            "token": token
        }
```

### 6. API Routes

#### Auth Routes (`routes/auth.py`)

```python
from flask import Blueprint, request, jsonify
from services.auth_service import AuthService

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not all([username, email, password]):
        return jsonify({"error": "All fields are required"}), 400
    
    result = AuthService.register_user(username, email, password)
    
    if "error" in result:
        return jsonify(result), 400
    
    return jsonify(result), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    username = data.get('username')
    password = data.get('password')
    
    if not all([username, password]):
        return jsonify({"error": "Username and password are required"}), 400
    
    result = AuthService.login_user(username, password)
    
    if "error" in result:
        return jsonify(result), 401
    
    return jsonify(result), 200
```

#### Chat Routes (`routes/chat.py`)

```python
from flask import Blueprint, request, jsonify, Response, stream_template
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import db, User, Conversation, Message
from services.ollama_service import create_ollama_service
import json

chat_bp = Blueprint('chat', __name__)

@chat_bp.route('/conversations', methods=['GET'])
@jwt_required()
def get_conversations():
    user_id = get_jwt_identity()
    conversations = Conversation.query.filter_by(user_id=user_id).order_by(Conversation.updated_at.desc()).all()
    
    return jsonify([{
        "id": conv.id,
        "title": conv.title,
        "model_name": conv.model_name,
        "created_at": conv.created_at.isoformat(),
        "updated_at": conv.updated_at.isoformat(),
        "message_count": len(conv.messages)
    } for conv in conversations])

@chat_bp.route('/conversations', methods=['POST'])
@jwt_required()
def create_conversation():
    user_id = get_jwt_identity()
    data = request.get_json()
    
    model_name = data.get('model_name', 'llama3.1:8b')
    title = data.get('title', 'New Conversation')
    
    conversation = Conversation(
        title=title,
        user_id=user_id,
        model_name=model_name
    )
    
    db.session.add(conversation)
    db.session.commit()
    
    return jsonify({
        "id": conversation.id,
        "title": conversation.title,
        "model_name": conversation.model_name,
        "created_at": conversation.created_at.isoformat(),
        "messages": []
    }), 201

@chat_bp.route('/conversations/<conversation_id>', methods=['GET'])
@jwt_required()
def get_conversation(conversation_id):
    user_id = get_jwt_identity()
    conversation = Conversation.query.filter_by(id=conversation_id, user_id=user_id).first()
    
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404
    
    messages = Message.query.filter_by(conversation_id=conversation_id).order_by(Message.timestamp.asc()).all()
    
    return jsonify({
        "id": conversation.id,
        "title": conversation.title,
        "model_name": conversation.model_name,
        "created_at": conversation.created_at.isoformat(),
        "messages": [{
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "timestamp": msg.timestamp.isoformat()
        } for msg in messages]
    })

@chat_bp.route('/conversations/<conversation_id>/messages', methods=['POST'])
@jwt_required()
def send_message(conversation_id):
    user_id = get_jwt_identity()
    conversation = Conversation.query.filter_by(id=conversation_id, user_id=user_id).first()
    
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404
    
    data = request.get_json()
    message_content = data.get('message', '').strip()
    
    if not message_content:
        return jsonify({"error": "Message cannot be empty"}), 400
    
    # Save user message
    user_message = Message(
        conversation_id=conversation_id,
        role='user',
        content=message_content
    )
    db.session.add(user_message)
    db.session.commit()
    
    # Get conversation history
    messages = Message.query.filter_by(conversation_id=conversation_id).order_by(Message.timestamp.asc()).all()
    
    # Prepare messages for Ollama
    ollama_messages = []
    for msg in messages:
        ollama_messages.append({
            "role": msg.role,
            "content": msg.content
        })
    
    # Generate streaming response
    def generate():
        ollama_service = create_ollama_service()
        assistant_response = ""
        
        try:
            for chunk in ollama_service.chat_stream(conversation.model_name, ollama_messages):
                assistant_response += chunk
                yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"
            
            # Save assistant response
            assistant_message = Message(
                conversation_id=conversation_id,
                role='assistant',
                content=assistant_response
            )
            db.session.add(assistant_message)
            
            # Update conversation timestamp and title if it's the first message
            if conversation.title == 'New Conversation' and len(messages) == 1:
                # Generate a title from the first message (truncated)
                conversation.title = message_content[:50] + "..." if len(message_content) > 50 else message_content
            
            db.session.commit()
            
            yield f"data: {json.dumps({'content': '', 'done': True, 'message_id': assistant_message.id})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"
    
    return Response(generate(), mimetype='text/event-stream',
                   headers={'Cache-Control': 'no-cache',
                           'Connection': 'keep-alive',
                           'Access-Control-Allow-Origin': '*'})

@chat_bp.route('/conversations/<conversation_id>', methods=['DELETE'])
@jwt_required()
def delete_conversation(conversation_id):
    user_id = get_jwt_identity()
    conversation = Conversation.query.filter_by(id=conversation_id, user_id=user_id).first()
    
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404
    
    db.session.delete(conversation)
    db.session.commit()
    
    return jsonify({"message": "Conversation deleted"}), 200

@chat_bp.route('/conversations/<conversation_id>/model', methods=['PUT'])
@jwt_required()
def change_conversation_model(conversation_id):
    user_id = get_jwt_identity()
    conversation = Conversation.query.filter_by(id=conversation_id, user_id=user_id).first()
    
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404
    
    data = request.get_json()
    new_model = data.get('model_name')
    
    if not new_model:
        return jsonify({"error": "Model name is required"}), 400
    
    # Verify model is available
    ollama_service = create_ollama_service()
    if not ollama_service.is_model_available(new_model):
        return jsonify({"error": f"Model {new_model} is not available"}), 400
    
    conversation.model_name = new_model
    db.session.commit()
    
    return jsonify({"message": f"Model changed to {new_model}"}), 200
```

#### Models Routes (`routes/models.py`)

```python
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from services.ollama_service import create_ollama_service

models_bp = Blueprint('models', __name__)

@models_bp.route('/models', methods=['GET'])
@jwt_required()
def get_available_models():
    ollama_service = create_ollama_service()
    models = ollama_service.get_available_models()
    
    return jsonify({
        "models": [
            {
                "name": model_data["name"],
                "size": model_data["size"],
                "modified_at": model_data["modified_at"]
            }
            for model_data in models.values()
        ]
    })

@models_bp.route('/models/<model_name>/pull', methods=['POST'])
@jwt_required()
def pull_model(model_name):
    ollama_service = create_ollama_service()
    success = ollama_service.pull_model(model_name)
    
    if success:
        return jsonify({"message": f"Model {model_name} pulled successfully"}), 200
    else:
        return jsonify({"error": f"Failed to pull model {model_name}"}), 500
```

### 7. Main Application (`app.py`)

```python
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
    CORS(app, origins=["http://localhost:3000"])  # React dev server
    
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
    app.run(debug=True, host='0.0.0.0', port=5000)
```

### 8. Environment Setup (`.env`)

```env
SECRET_KEY=your-super-secret-key-change-this
JWT_SECRET_KEY=your-jwt-secret-key-change-this
DATABASE_URL=sqlite:///chatbot.db
OLLAMA_BASE_URL=http://localhost:11434
FLASK_ENV=development
```

## Phase 2: Frontend Setup

### 1. Initialize React Application

```bash
cd .. # Go back to project root
npx create-react-app frontend
cd frontend

# Install additional dependencies
npm install axios react-router-dom @heroicons/react tailwindcss
npx tailwindcss init -p
```

### 2. Configure Tailwind CSS

Update `tailwind.config.js`:
```javascript
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Update `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

# Phase 2: React Frontend Development

## 1. Package.json Dependencies

Update `frontend/package.json` dependencies:
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "axios": "^1.3.0",
    "@heroicons/react": "^2.0.0",
    "react-markdown": "^8.0.5",
    "remark-gfm": "^3.0.1",
    "react-syntax-highlighter": "^15.5.0",
    "date-fns": "^2.29.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

## 2. Enhanced Tailwind Configuration

Update `tailwind.config.js`:
```javascript
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Claude.ai inspired color palette
        'claude': {
          50: '#fdf8f6',
          100: '#f2e8e5',
          200: '#eaddd7',
          300: '#e0cec7',
          400: '#d2bab0',
          500: '#b7a092',
          600: '#a18072',
          700: '#977669',
          800: '#846358',
          900: '#43302b',
        },
        'orange': {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        'neutral': {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        }
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-subtle': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
```

## 3. Global Styles and Fonts

Update `src/index.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    font-family: 'Inter', system-ui, sans-serif;
  }
  
  code {
    font-family: 'JetBrains Mono', monospace;
  }
}

@layer components {
  .btn-primary {
    @apply bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200;
  }
  
  .btn-secondary {
    @apply bg-neutral-200 hover:bg-neutral-300 text-neutral-900 font-medium py-2 px-4 rounded-lg transition-colors duration-200;
  }
  
  .input-field {
    @apply w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent;
  }
  
  .sidebar-item {
    @apply flex items-center px-3 py-2 rounded-lg text-sm text-neutral-700 hover:bg-neutral-100 transition-colors duration-150 cursor-pointer;
  }
  
  .sidebar-item.active {
    @apply bg-orange-50 text-orange-900 border-r-2 border-orange-600;
  }
  
  .message-user {
    @apply bg-neutral-50 border border-neutral-200;
  }
  
  .message-assistant {
    @apply bg-white border border-neutral-200;
  }
  
  .typing-indicator {
    @apply animate-pulse-subtle;
  }
}
```

## 4. Services Layer

### API Service (`src/services/api.js`)
```javascript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle auth errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(username, password) {
    const response = await this.api.post('/auth/login', { username, password });
    return response.data;
  }

  async register(username, email, password) {
    const response = await this.api.post('/auth/register', { username, email, password });
    return response.data;
  }

  // Chat endpoints
  async getConversations() {
    const response = await this.api.get('/chat/conversations');
    return response.data;
  }

  async getConversation(conversationId) {
    const response = await this.api.get(`/chat/conversations/${conversationId}`);
    return response.data;
  }

  async createConversation(title = 'New Conversation', modelName = 'llama3.1:8b') {
    const response = await this.api.post('/chat/conversations', {
      title,
      model_name: modelName,
    });
    return response.data;
  }

  async deleteConversation(conversationId) {
    const response = await this.api.delete(`/chat/conversations/${conversationId}`);
    return response.data;
  }

  async changeConversationModel(conversationId, modelName) {
    const response = await this.api.put(`/chat/conversations/${conversationId}/model`, {
      model_name: modelName,
    });
    return response.data;
  }

  // Streaming message endpoint
  async sendMessage(conversationId, message, onChunk, onComplete, onError) {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.error) {
                onError(data.error);
                return;
              }
              
              if (data.done) {
                onComplete(data);
                return;
              }
              
              if (data.content) {
                onChunk(data.content);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      onError(error.message);
    }
  }

  // Models endpoints
  async getAvailableModels() {
    const response = await this.api.get('/models');
    return response.data;
  }

  async pullModel(modelName) {
    const response = await this.api.post(`/models/${modelName}/pull`);
    return response.data;
  }
}

export default new ApiService();
```

### Auth Service (`src/services/auth.js`)
```javascript
import apiService from './api';

class AuthService {
  constructor() {
    this.user = this.getStoredUser();
    this.token = this.getStoredToken();
  }

  getStoredUser() {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  }

  getStoredToken() {
    return localStorage.getItem('token');
  }

  isAuthenticated() {
    return !!(this.token && this.user);
  }

  async login(username, password) {
    try {
      const data = await apiService.login(username, password);
      
      this.user = data.user;
      this.token = data.token;
      
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      
      return { success: true, user: data.user };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
    }
  }

  async register(username, email, password) {
    try {
      const data = await apiService.register(username, email, password);
      
      this.user = data.user;
      this.token = data.token;
      
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      
      return { success: true, user: data.user };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed',
      };
    }
  }

  logout() {
    this.user = null;
    this.token = null;
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }

  getCurrentUser() {
    return this.user;
  }
}

export default new AuthService();
```

## 5. Context Providers

### Auth Context (`src/context/AuthContext.js`)
```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const currentUser = authService.getCurrentUser();
    if (currentUser && authService.isAuthenticated()) {
      setUser(currentUser);
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const result = await authService.login(username, password);
    if (result.success) {
      setUser(result.user);
    }
    return result;
  };

  const register = async (username, email, password) => {
    const result = await authService.register(username, email, password);
    if (result.success) {
      setUser(result.user);
    }
    return result;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

### Chat Context (`src/context/ChatContext.js`)
```javascript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    loadAvailableModels();
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const conversationsList = await apiService.getConversations();
      setConversations(conversationsList);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }, []);

  const loadAvailableModels = useCallback(async () => {
    try {
      const modelsData = await apiService.getAvailableModels();
      setAvailableModels(modelsData.models || []);
    } catch (error) {
      console.error('Error loading models:', error);
    }
  }, []);

  const createNewConversation = async (title = 'New Conversation', modelName = 'llama3.1:8b') => {
    try {
      const newConversation = await apiService.createConversation(title, modelName);
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversation(newConversation);
      setMessages([]);
      return newConversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  };

  const selectConversation = async (conversationId) => {
    if (currentConversation?.id === conversationId) return;

    try {
      setIsLoading(true);
      const conversation = await apiService.getConversation(conversationId);
      setCurrentConversation(conversation);
      setMessages(conversation.messages || []);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (messageContent) => {
    if (!currentConversation || isStreaming) return;

    // Add user message immediately
    const userMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Add empty assistant message for streaming
    const assistantMessageId = `temp-assistant-${Date.now()}`;
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsStreaming(true);

    // Stream the response
    await apiService.sendMessage(
      currentConversation.id,
      messageContent,
      // onChunk
      (chunk) => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      },
      // onComplete
      (data) => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false, id: data.message_id || msg.id }
              : msg
          )
        );
        setIsStreaming(false);
        // Reload conversations to update timestamps
        loadConversations();
      },
      // onError
      (error) => {
        console.error('Streaming error:', error);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: `Error: ${error}`, isStreaming: false, error: true }
              : msg
          )
        );
        setIsStreaming(false);
      }
    );
  };

  const deleteConversation = async (conversationId) => {
    try {
      await apiService.deleteConversation(conversationId);
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const changeModel = async (conversationId, modelName) => {
    try {
      await apiService.changeConversationModel(conversationId, modelName);
      
      // Update the conversation in state
      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId ? { ...conv, model_name: modelName } : conv
        )
      );
      
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(prev => ({ ...prev, model_name: modelName }));
      }
    } catch (error) {
      console.error('Error changing model:', error);
      throw error;
    }
  };

  const value = {
    conversations,
    currentConversation,
    messages,
    isLoading,
    isStreaming,
    availableModels,
    createNewConversation,
    selectConversation,
    sendMessage,
    deleteConversation,
    changeModel,
    loadConversations,
    loadAvailableModels,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
```

## 6. Core Components

### Loading Spinner (`src/components/Common/LoadingSpinner.js`)
```javascript
import React from 'react';

const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`${sizeClasses[size]} border-2 border-neutral-300 border-t-orange-600 rounded-full animate-spin`}
      />
    </div>
  );
};

export default LoadingSpinner;
```

### Button Component (`src/components/Common/Button.js`)
```javascript
import React from 'react';
import LoadingSpinner from './LoadingSpinner';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) => {
  const baseClasses = 'font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2';
  
  const variants = {
    primary: 'bg-orange-600 hover:bg-orange-700 text-white disabled:bg-neutral-400',
    secondary: 'bg-neutral-200 hover:bg-neutral-300 text-neutral-900 disabled:bg-neutral-100',
    outline: 'border border-neutral-300 hover:bg-neutral-50 text-neutral-900 disabled:bg-neutral-50',
    ghost: 'hover:bg-neutral-100 text-neutral-700 disabled:text-neutral-400',
    danger: 'bg-red-600 hover:bg-red-700 text-white disabled:bg-neutral-400',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className} ${
        isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
```

### Input Component (`src/components/Common/Input.js`)
```javascript
import React, { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  error,
  helperText,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  return (
    <div className={`${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`input-field ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-neutral-500">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
```

## 7. Authentication Components

### Login Form (`src/components/Auth/LoginForm.js`)
```javascript
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../Common/Button';
import Input from '../Common/Input';
import { useAuth } from '../../context/AuthContext';

const LoginForm = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    const newErrors = {};
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    const result = await login(formData.username, formData.password);
    
    if (!result.success) {
      setErrors({ general: result.error });
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-neutral-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Or{' '}
            <Link
              to="/register"
              className="font-medium text-orange-600 hover:text-orange-500"
            >
              create a new account
            </Link>
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {errors.general}
            </div>
          )}
          
          <div className="space-y-4">
            <Input
              label="Username"
              name="username"
              type="text"
              autoComplete="username"
              value={formData.username}
              onChange={handleChange}
              error={errors.username}
              placeholder="Choose a username"
            />
            
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              placeholder="Enter your email"
            />
            
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              placeholder="Choose a password"
            />
            
            <Input
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              placeholder="Confirm your password"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            loading={isLoading}
            size="lg"
          >
            Create Account
          </Button>
        </form>
      </div>
    </div>
  );
};

export default RegisterForm;
```

## 8. Sidebar Components

### Conversation List (`src/components/Sidebar/ConversationList.js`)
```javascript
import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  ChatBubbleLeftIcon, 
  TrashIcon, 
  EllipsisHorizontalIcon 
} from '@heroicons/react/24/outline';
import { useChat } from '../../context/ChatContext';
import Button from '../Common/Button';

const ConversationItem = ({ conversation, isActive, onClick, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await onDelete(conversation.id);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    } finally {
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div
      className={`group relative p-3 rounded-lg cursor-pointer transition-all duration-200 ${
        isActive 
          ? 'bg-orange-50 border-l-4 border-orange-500' 
          : 'hover:bg-neutral-50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <div className={`p-2 rounded-lg ${isActive ? 'bg-orange-100' : 'bg-neutral-100'}`}>
            <ChatBubbleLeftIcon className="w-4 h-4 text-neutral-600" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className={`font-medium truncate ${
              isActive ? 'text-orange-900' : 'text-neutral-900'
            }`}>
              {conversation.title}
            </h3>
            
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-neutral-500">
                {conversation.message_count} messages
              </p>
              <p className="text-xs text-neutral-400">
                {formatDate(conversation.updated_at)}
              </p>
            </div>
            
            <div className="mt-1">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${
                isActive ? 'bg-orange-100 text-orange-800' : 'bg-neutral-100 text-neutral-600'
              }`}>
                {conversation.model_name}
              </span>
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-neutral-200 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            <EllipsisHorizontalIcon className="w-4 h-4 text-neutral-600" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
              <button
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <TrashIcon className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ConversationList = () => {
  const { conversations, currentConversation, selectConversation, deleteConversation } = useChat();

  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-neutral-500">
        <ChatBubbleLeftIcon className="w-12 h-12 mx-auto mb-2 text-neutral-300" />
        <p className="text-sm">No conversations yet</p>
        <p className="text-xs mt-1">Start a new chat to begin</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          isActive={currentConversation?.id === conversation.id}
          onClick={() => selectConversation(conversation.id)}
          onDelete={deleteConversation}
        />
      ))}
    </div>
  );
};

export default ConversationList;
```

### Model Selector (`src/components/Sidebar/ModelSelector.js`)
```javascript
import React, { useState } from 'react';
import { ChevronDownIcon, CpuChipIcon } from '@heroicons/react/24/outline';
import { useChat } from '../../context/ChatContext';
import Button from '../Common/Button';

const ModelSelector = () => {
  const { currentConversation, availableModels, changeModel } = useChat();
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  const handleModelChange = async (modelName) => {
    if (!currentConversation || modelName === currentConversation.model_name) {
      setIsOpen(false);
      return;
    }

    setIsChanging(true);
    try {
      await changeModel(currentConversation.id, modelName);
    } catch (error) {
      console.error('Failed to change model:', error);
    } finally {
      setIsChanging(false);
      setIsOpen(false);
    }
  };

  if (!currentConversation) {
    return null;
  }

  const currentModel = availableModels.find(
    model => model.name === currentConversation.model_name
  ) || { name: currentConversation.model_name };

  return (
    <div className="relative">
      <button
        className="w-full flex items-center justify-between p-3 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isChanging}
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <CpuChipIcon className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-neutral-900 truncate">
              {currentModel.name}
            </p>
            <p className="text-xs text-neutral-500">
              {isChanging ? 'Changing...' : 'Current model'}
            </p>
          </div>
        </div>
        <ChevronDownIcon 
          className={`w-4 h-4 text-neutral-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
          <div className="p-2">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide px-2 py-1">
              Available Models
            </p>
            {availableModels.map((model) => (
              <button
                key={model.name}
                className={`w-full text-left p-2 rounded hover:bg-neutral-50 transition-colors ${
                  model.name === currentConversation.model_name
                    ? 'bg-orange-50 text-orange-900'
                    : 'text-neutral-700'
                }`}
                onClick={() => handleModelChange(model.name)}
              >
                <div className="font-mono text-sm">{model.name}</div>
                {model.size && (
                  <div className="text-xs text-neutral-500">
                    {(model.size / (1024 * 1024 * 1024)).toFixed(1)} GB
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
```

### Main Sidebar (`src/components/Sidebar/Sidebar.js`)
```javascript
import React from 'react';
import { 
  PlusIcon, 
  ArrowRightOnRectangleIcon,
  UserIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import ConversationList from './ConversationList';
import ModelSelector from './ModelSelector';
import Button from '../Common/Button';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { createNewConversation } = useChat();

  const handleNewChat = async () => {
    try {
      await createNewConversation();
    } catch (error) {
      console.error('Failed to create new conversation:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-50 border-r border-neutral-200">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-neutral-900">
            TwiGpt
          </h1>
          <Button
            variant="primary"
            size="sm"
            onClick={handleNewChat}
            className="flex items-center space-x-1"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New</span>
          </Button>
        </div>
        
        <ModelSelector />
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        <ConversationList />
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-neutral-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-neutral-100 rounded-full">
              <UserIcon className="w-4 h-4 text-neutral-600" />
            </div>
            <div>
              <p className="font-medium text-neutral-900 text-sm">
                {user?.username}
              </p>
              <p className="text-xs text-neutral-500">
                {user?.email}
              </p>
            </div>
          </div>
          
          <div className="flex space-x-1">
            <button className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
              <Cog6ToothIcon className="w-4 h-4" />
            </button>
            <button 
              className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
              onClick={logout}
              title="Sign out"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
```

## 9. Chat Components

### Message Component (`src/components/Chat/Message.js`)
```javascript
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { formatDistanceToNow } from 'date-fns';
import { 
  UserIcon, 
  CpuChipIcon, 
  ClipboardIcon,
  CheckIcon 
} from '@heroicons/react/24/outline';
import { useState } from 'react';

const CodeBlock = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="relative group">
      <div className="flex items-center justify-between bg-neutral-800 px-4 py-2 rounded-t-lg">
        <span className="text-sm text-neutral-300 font-mono">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded text-xs transition-colors"
        >
          {copied ? (
            <>
              <CheckIcon className="w-3 h-3" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <ClipboardIcon className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

const Message = ({ message, isLast = false }) => {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;
  const hasError = message.error;

  const formatTime = (timestamp) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'now';
    }
  };

  return (
    <div className={`group px-4 py-6 ${isUser ? 'bg-neutral-50' : 'bg-white'}`}>
      <div className="max-w-3xl mx-auto">
        <div className="flex space-x-4">
          {/* Avatar */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser 
              ? 'bg-orange-500' 
              : hasError 
                ? 'bg-red-500' 
                : 'bg-neutral-700'
          }`}>
            {isUser ? (
              <UserIcon className="w-5 h-5 text-white" />
            ) : (
              <CpuChipIcon className="w-5 h-5 text-white" />
            )}
          </div>

          {/* Message Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline space-x-2 mb-2">
              <span className="font-medium text-neutral-900">
                {isUser ? 'You' : 'Assistant'}
              </span>
              <span className="text-xs text-neutral-400">
                {formatTime(message.timestamp)}
              </span>
              {isStreaming && (
                <span className="text-xs text-orange-600 animate-pulse">
                  Thinking...
                </span>
              )}
            </div>

            <div className={`prose prose-sm max-w-none ${
              hasError ? 'text-red-600' : 'text-neutral-900'
            }`}>
              {isUser ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <ReactMarkdown
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const language = match ? match[1] : '';
                      
                      if (!inline && language) {
                        return (
                          <CodeBlock
                            language={language}
                            value={String(children).replace(/\n$/, '')}
                          />
                        );
                      }
                      
                      return (
                        <code 
                          className="bg-neutral-100 text-orange-600 px-1 py-0.5 rounded text-sm font-mono"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                    pre({ children }) {
                      return <>{children}</>;
                    },
                    blockquote({ children }) {
                      return (
                        <blockquote className="border-l-4 border-orange-200 pl-4 my-4 text-neutral-700 italic">
                          {children}
                        </blockquote>
                      );
                    },
                    table({ children }) {
                      return (
                        <div className="overflow-x-auto my-4">
                          <table className="min-w-full border-collapse border border-neutral-200">
                            {children}
                          </table>
                        </div>
                      );
                    },
                    th({ children }) {
                      return (
                        <th className="border border-neutral-200 bg-neutral-50 px-3 py-2 text-left font-medium">
                          {children}
                        </th>
                      );
                    },
                    td({ children }) {
                      return (
                        <td className="border border-neutral-200 px-3 py-2">
                          {children}
                        </td>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
              
              {isStreaming && isLast && (
                <div className="flex items-center space-x-1 mt-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Message;
```

### Message Input (`src/components/Chat/MessageInput.js`)
```javascript
import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useChat } from '../../context/ChatContext';
import Button from '../Common/Button';

const MessageInput = () => {
  const [message, setMessage] = useState('');
  const [rows, setRows] = useState(1);
  const textareaRef = useRef(null);
  
  const { currentConversation, sendMessage, isStreaming, createNewConversation } = useChat();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // Max height in pixels
      const newHeight = Math.min(scrollHeight, maxHeight);
      textareaRef.current.style.height = `${newHeight}px`;
      
      // Calculate rows based on line height (approximately 24px per line)
      const newRows = Math.min(Math.max(Math.ceil(scrollHeight / 24), 1), 8);
      setRows(newRows);
    }
  }, [message]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!message.trim() || isStreaming) return;

    // If no conversation exists, create one
    let conversation = currentConversation;
    if (!conversation) {
      try {
        conversation = await createNewConversation();
      } catch (error) {
        console.error('Failed to create conversation:', error);
        return;
      }
    }

    const messageToSend = message.trim();
    setMessage('');
    
    try {
      await sendMessage(messageToSend);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore message on error
      setMessage(messageToSend);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isDisabled = isStreaming || !message.trim();

  return (
    <div className="border-t border-neutral-200 bg-white">
      <div className="max-w-3xl mx-auto p-4">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-end space-x-3">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  currentConversation 
                    ? "Type your message... (Enter to send, Shift+Enter for new line)"
                    : "Start a new conversation..."
                }
                disabled={isStreaming}
                className={`w-full px-4 py-3 pr-12 border border-neutral-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors ${
                  isStreaming ? 'bg-neutral-50 cursor-not-allowed' : 'bg-white'
                }`}
                rows={rows}
                style={{ minHeight: '52px', maxHeight: '200px' }}
              />
              
              <div className="absolute right-3 bottom-3">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isDisabled}
                  className="p-2"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          
          {isStreaming && (
            <div className="mt-2 text-sm text-orange-600 flex items-center space-x-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span>Assistant is thinking...</span>
            </div>
          )}
          
          <div className="mt-2 text-xs text-neutral-500 flex items-center justify-between">
            <span>
              {currentConversation ? (
                `Using ${currentConversation.model_name}`
              ) : (
                'Will create new conversation'
              )}
            </span>
            <span>
              Enter to send • Shift+Enter for new line
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MessageInput;
```

### Chat Area (`src/components/Chat/ChatArea.js`)
```javascript
import React, { useEffect, useRef } from 'react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useChat } from '../../context/ChatContext';
import Message from './Message';
import MessageInput from './MessageInput';
import LoadingSpinner from '../Common/LoadingSpinner';

const EmptyState = () => (
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="text-center max-w-md">
      <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <ChatBubbleLeftRightIcon className="w-8 h-8 text-orange-600" />
      </div>
      <h3 className="text-lg font-medium text-neutral-900 mb-2">
        Welcome to TwiGpt
      </h3>
      <p className="text-neutral-600 text-sm leading-relaxed">
        Start a conversation with your local AI assistant. Your data stays private 
        and runs entirely on your machine using Ollama.
      </p>
      <div className="mt-6 p-4 bg-neutral-50 rounded-lg text-left">
        <h4 className="font-medium text-neutral-900 mb-2">Tips:</h4>
        <ul className="text-sm text-neutral-600 space-y-1">
          <li>• Ask questions, request explanations, or get help with code</li>
          <li>• Switch between different AI models anytime</li>
          <li>• All conversations are saved locally</li>
        </ul>
      </div>
    </div>
  </div>
);

const ChatArea = () => {
  const { currentConversation, messages, isLoading } = useChat();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-neutral-600">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (!currentConversation && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <EmptyState />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      {currentConversation && (
        <div className="border-b border-neutral-200 bg-white px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <h2 className="font-medium text-neutral-900 truncate">
                {currentConversation.title}
              </h2>
              <p className="text-sm text-neutral-500">
                {messages.length} messages • {currentConversation.model_name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto"
      >
        <div className="min-h-full">
          {messages.map((message, index) => (
            <Message
              key={message.id}
              message={message}
              isLast={index === messages.length - 1}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <MessageInput />
    </div>
  );
};

export default ChatArea;
```

## 10. Main App Components

### Protected Route (`src/components/Common/ProtectedRoute.js`)
```javascript
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
```

### Main Chat Page (`src/components/Chat/ChatPage.js`)
```javascript
import React from 'react';
import { ChatProvider } from '../../context/ChatContext';
import Sidebar from '../Sidebar/Sidebar';
import ChatArea from './ChatArea';

const ChatPage = () => {
  return (
    <ChatProvider>
      <div className="h-screen flex bg-white">
        {/* Sidebar */}
        <div className="w-80 flex-shrink-0">
          <Sidebar />
        </div>
        
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <ChatArea />
        </div>
      </div>
    </ChatProvider>
  );
};

export default ChatPage;
```

## 11. App Router and Main App

### Main App Component (`src/App.js`)
```javascript
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/Common/ProtectedRoute';
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import ChatPage from './components/Chat/ChatPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            
            {/* Protected routes */}
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            
            {/* Redirect root to chat */}
            <Route path="/" element={<Navigate to="/chat" replace />} />
            
            {/* Catch all - redirect to chat */}
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
```

### Environment Configuration (`src/.env`)
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_NAME=TwiGpt
```

## 12. Additional Utility Components

### Error Boundary (`src/components/Common/ErrorBoundary.js`)
```javascript
import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50">
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-neutral-600 mb-4">
              An unexpected error occurred. Please refresh the page and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### Toast Notifications (`src/components/Common/Toast.js`)
```javascript
import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const Toast = ({ toast, onRemove }) => {
  const icons = {
    success: CheckCircleIcon,
    error: ExclamationCircleIcon,
    info: InformationCircleIcon,
  };

  const colors = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  };

  const Icon = icons[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div className={`flex items-center p-4 rounded-lg border ${colors[toast.type]} shadow-lg animate-slide-up`}>
      <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
      <div className="flex-1">
        {toast.title && (
          <p className="font-medium">{toast.title}</p>
        )}
        <p className={toast.title ? 'text-sm mt-1' : ''}>{toast.message}</p>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-3 text-current hover:opacity-70"
      >
        <XMarkIcon className="w-5 h-5" />
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (toast) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { ...toast, id }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showSuccess = (message, title) => addToast({ type: 'success', message, title });
  const showError = (message, title) => addToast({ type: 'error', message, title });
  const showInfo = (message, title) => addToast({ type: 'info', message, title });

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showInfo }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
```

## 13. Final Integration

### Updated Main App with Error Boundary and Toasts (`src/App.js`)
```javascript
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Common/Toast';
import ErrorBoundary from './components/Common/ErrorBoundary';
import ProtectedRoute from './components/Common/ProtectedRoute';
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import ChatPage from './components/Chat/ChatPage';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <ToastProvider>
            <div className="App">
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginForm />} />
                <Route path="/register" element={<RegisterForm />} />
                
                {/* Protected routes */}
                <Route
                  path="/chat"
                  element={
                    <ProtectedRoute>
                      <ChatPage />
                    </ProtectedRoute>
                  }
                />
                
                {/* Redirect root to chat */}
                <Route path="/" element={<Navigate to="/chat" replace />} />
                
                {/* Catch all - redirect to chat */}
                <Route path="*" element={<Navigate to="/chat" replace />} />
              </Routes>
            </div>
          </ToastProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
```

### Package.json Scripts Update (`frontend/package.json`)
```json
{
  "name": "ollama-chatbot-frontend",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "axios": "^1.3.0",
    "@heroicons/react": "^2.0.0",
    "react-markdown": "^8.0.5",
    "remark-gfm": "^3.0.1",
    "react-syntax-highlighter": "^15.5.0",
    "date-fns": "^2.29.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "devDependencies": {
    "react-scripts": "5.0.1",
    "tailwindcss": "^3.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  },
  "proxy": "http://localhost:5000"
}
```

## 14. Running the Complete Application

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### Frontend Setup  
```bash
cd frontend
npm install
npm start
```

### Ollama Setup
```bash
# Make sure Ollama is running
ollama serve

# Pull your preferred models
ollama pull llama3.1:8b
ollama pull qwen3:8b
ollama pull mistral:7b
```

## 15. Features Summary

### ✅ Complete Features
- **Authentication**: Secure login/register with JWT
- **Real-time Chat**: Streaming responses just like Claude
- **Model Management**: Easy switching between Ollama models
- **Conversation History**: Persistent chat sessions
- **Modern UI**: Claude.ai inspired design with Tailwind CSS
- **Responsive Design**: Works on desktop and mobile
- **Error Handling**: Comprehensive error boundaries and validation
- **Toast Notifications**: User feedback system
- **Code Highlighting**: Syntax highlighting for code blocks
- **Markdown Support**: Rich text rendering
- **Auto-scroll**: Smooth message scrolling
- **Privacy-First**: All data stays local

### 🎨 UI/UX Features
- Claude.ai color palette (oranges, neutrals)
- Smooth animations and transitions  
- Clean, professional sidebar design
- Message bubbles with proper spacing
- Typing indicators and loading states
- Copy code functionality
- Responsive layout
- Modern typography (Inter font)

### 🔧 Technical Features
- Factory pattern for model switching
- Streaming API responses
- JWT authentication
- SQLite database with migrations
- React Context for state management
- Error boundaries and fallbacks
- Toast notification system
- Protected routes
- API service layer

## 16. Next Steps & Enhancements

### Possible Improvements:
1. **Settings Panel**: Theme switching, model preferences
2. **Export Chats**: Download conversations as markdown/PDF  
3. **Search**: Find messages across conversations
4. **File Upload**: Chat about documents/images
5. **Voice Input**: Speech-to-text functionality
6. **Model Performance Stats**: Response times, model info
7. **Conversation Folders**: Organize chats by topic
8. **Sharing**: Export/import conversations

The application is now complete with a professional, Claude.ai-inspired interface running entirely locally with Ollama! 🚀
              autoComplete="username"
              value={formData.username}
              onChange={handleChange}
              error={errors.username}
              placeholder="Enter your username"
            />
            
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              placeholder="Enter your password"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            loading={isLoading}
            size="lg"
          >
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;
```

### Register Form (`src/components/Auth/RegisterForm.js`)
```javascript
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../Common/Button';
import Input from '../Common/Input';
import { useAuth } from '../../context/AuthContext';

const RegisterForm = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  
  const { register } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    const result = await register(formData.username, formData.email, formData.password);
    
    if (!result.success) {
      setErrors({ general: result.error });
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-neutral-900">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-orange-600 hover:text-orange-500"
            >
              Sign in
            </Link>
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {errors.general}
            </div>
          )}
          
          <div className="space-y-4">
            <Input
              label="Username"
              name="username"
              type="text"