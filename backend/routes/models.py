from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from services.ollama_service import create_ollama_service
from services.huggingface_service import create_huggingface_service

models_bp = Blueprint('models', __name__)

@models_bp.route('/models', methods=['GET'])
@jwt_required()
def get_available_models():
    ollama_service = create_ollama_service()
    huggingface_service = create_huggingface_service()

    ollama_models = ollama_service.get_available_models()
    hf_models = huggingface_service.get_available_models()

    # Combine models from both services
    all_models = {**ollama_models, **hf_models}

    return jsonify({
        "models": [
            {
                "name": model_data["name"],
                "size": model_data["size"],
                "modified_at": model_data["modified_at"]
            }
            for model_data in all_models.values()
        ]
    })

@models_bp.route('/models/<model_name>/pull', methods=['POST'])
@jwt_required()
def pull_model(model_name):
    ollama_service = create_ollama_service()
    huggingface_service = create_huggingface_service()

    # Only Ollama models can be pulled
    if ollama_service.is_model_available(model_name):
        success = ollama_service.pull_model(model_name)
        if success:
            return jsonify({"message": f"Model {model_name} pulled successfully"}), 200
        else:
            return jsonify({"error": f"Failed to pull model {model_name}"}), 500
    elif huggingface_service.is_model_available(model_name):
        return jsonify({"error": f"Model {model_name} cannot be pulled (Hugging Face model)"}), 400
    else:
        return jsonify({"error": f"Model {model_name} not found"}), 404