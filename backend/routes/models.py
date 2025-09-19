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