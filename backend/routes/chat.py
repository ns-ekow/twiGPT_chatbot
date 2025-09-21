from flask import Blueprint, request, jsonify, Response, stream_template, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import db, User, Conversation, Message
from services.ollama_service import create_ollama_service
from services.speech_service import create_speech_service
from datetime import datetime
import json
import os
import tempfile

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
    
    model_name = data.get('model_name', 'qwen3:latest')
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

    # Store needed data
    model_name = conversation.model_name
    conversation_title = conversation.title
    message_count = len(messages)

    # Capture app object for context management in generator
    app = current_app._get_current_object()

    # Generate streaming response
    def generate():
        print(f"[DEBUG] Starting generate() for conversation {conversation_id}")
        # Push application context for the generator
        with app.app_context():
            print("[DEBUG] App context pushed successfully")
            ollama_service = create_ollama_service()
            assistant_response = ""
            chunk_count = 0

            try:
                print(f"[DEBUG] Starting Ollama stream for model {model_name}")
                for chunk in ollama_service.chat_stream(model_name, ollama_messages):
                    assistant_response += chunk
                    chunk_count += 1
                    if chunk_count % 10 == 0:  # Log every 10 chunks
                        print(f"[DEBUG] Processed {chunk_count} chunks, current response length: {len(assistant_response)}")
                    yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"

                print(f"[DEBUG] Stream completed, total chunks: {chunk_count}, response length: {len(assistant_response)}")

                # Save assistant response
                print("[DEBUG] Saving assistant message to database")
                assistant_message = Message(
                    conversation_id=conversation_id,
                    role='assistant',
                    content=assistant_response
                )
                db.session.add(assistant_message)

                # Update conversation title if it's the first message
                if conversation_title == 'New Conversation' and message_count == 1:
                    print("[DEBUG] Updating conversation title")
                    conv_to_update = Conversation.query.filter_by(id=conversation_id).first()
                    if conv_to_update:
                        conv_to_update.title = message_content[:50] + "..." if len(message_content) > 50 else message_content
                        conv_to_update.updated_at = datetime.utcnow()

                db.session.commit()
                print(f"[DEBUG] Database commit successful, message_id: {assistant_message.id}")

                yield f"data: {json.dumps({'content': '', 'done': True, 'message_id': assistant_message.id})}\n\n"

            except Exception as e:
                print(f"[ERROR] Exception in generate(): {str(e)}")
                db.session.rollback()
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

@chat_bp.route('/asr', methods=['POST'])
@jwt_required()
def transcribe_audio():
    """Transcribe uploaded audio file to text"""
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400

        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({"error": "No audio file selected"}), 400

        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as temp_file:
            audio_file.save(temp_file.name)
            temp_path = temp_file.name

        try:
            # Transcribe using speech service
            speech_service = create_speech_service()
            language = request.form.get('language', 'tw')
            transcription = speech_service.transcribe_audio(temp_path, language)

            return jsonify({"text": transcription}), 200

        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@chat_bp.route('/tts', methods=['POST'])
@jwt_required()
def synthesize_text():
    """Synthesize text to speech and return audio file"""
    try:
        data = request.get_json()
        text = data.get('text', '').strip()
        language = data.get('language', 'tw')
        speaker_id = data.get('speaker_id', 'twi_speaker_4')

        if not text:
            return jsonify({"error": "Text is required"}), 400

        # Generate speech
        speech_service = create_speech_service()
        audio_path = speech_service.synthesize_text(text, language, speaker_id)

        try:
            # Return audio file
            return send_file(
                audio_path,
                mimetype='audio/wav',
                as_attachment=True,
                download_name='speech.wav'
            )

        finally:
            # Clean up temp file
            if os.path.exists(audio_path):
                os.unlink(audio_path)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

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