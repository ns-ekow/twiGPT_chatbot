from flask import Blueprint, request, jsonify, Response, stream_template, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import db, User, Conversation, Message, FineTuneData
from services.ollama_service import create_ollama_service
from services.huggingface_service import create_huggingface_service, HuggingFaceService
from services.speech_service import create_speech_service
from datetime import datetime
import json
import os
import tempfile
import threading
import queue
import time

chat_bp = Blueprint('chat', __name__)

def get_model_service(model_name: str):
    """Get the appropriate service for a model"""
    ollama_service = create_ollama_service()
    huggingface_service = create_huggingface_service()

    if ollama_service.is_model_available(model_name):
        return ollama_service
    elif huggingface_service.is_model_available(model_name):
        return huggingface_service
    else:
        raise ValueError(f"Model {model_name} not available")

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
            "audio_url": msg.audio_url,
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
    parallel = data.get('parallel', False)
    second_model = data.get('second_model', 'llama3.2:latest') if parallel else None

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

    # Store needed data
    model_name = conversation.model_name
    conversation_title = conversation.title

    # Get model service to determine context handling
    model_service = get_model_service(model_name)

    # Get conversation history
    messages = Message.query.filter_by(conversation_id=conversation_id).order_by(Message.timestamp.asc()).all()
    message_count = len(messages)

    # Prepare messages based on service type
    if isinstance(model_service, HuggingFaceService):
        # For Hugging Face models, only send the last user message
        ollama_messages = [{"role": "user", "content": message_content}]
    else:
        # For Ollama models, send full context
        ollama_messages = []
        for msg in messages:
            ollama_messages.append({
                "role": msg.role,
                "content": msg.content
            })

    # Capture app object for context management in generator
    app = current_app._get_current_object()

    def stream_to_queue(model_name, service, all_messages, current_message_content, q, model_index):
        with app.app_context():
            try:
                # Prepare messages based on service type for this specific model
                from services.huggingface_service import HuggingFaceService
                if isinstance(service, HuggingFaceService):
                    # For Hugging Face models, only send the last user message
                    prepared_messages = [{"role": "user", "content": current_message_content}]
                else:
                    # For Ollama models, send full context
                    prepared_messages = []
                    for msg in all_messages:
                        prepared_messages.append({
                            "role": msg.role,
                            "content": msg.content
                        })

                for chunk in service.chat_stream(model_name, prepared_messages):
                    q.put({'content': chunk, 'model': model_name, 'model_index': model_index, 'done': False})
                q.put({'done': True, 'model': model_name, 'model_index': model_index})
            except Exception as e:
                q.put({'error': str(e), 'model': model_name, 'model_index': model_index})

    # Generate streaming response
    def generate():
        print(f"[DEBUG] Starting generate() for conversation {conversation_id}")
        # Push application context for the generator
        with app.app_context():
            print("[DEBUG] App context pushed successfully")
            try:
                if parallel:
                    # Parallel mode
                    second_service = get_model_service(second_model)

                    q = queue.Queue()
                    t1 = threading.Thread(target=stream_to_queue, args=(model_name, model_service, messages, message_content, q, 0))
                    t2 = threading.Thread(target=stream_to_queue, args=(second_model, second_service, messages, message_content, q, 1))
                    t1.start()
                    t2.start()

                    responses = ['', '']
                    done_count = 0

                    while done_count < 2:
                        item = q.get()
                        if 'error' in item:
                            yield f"data: {json.dumps({'error': item['error'], 'done': True})}\n\n"
                            return
                        if item['done']:
                            done_count += 1
                            continue
                        responses[item['model_index']] += item['content']
                        yield f"data: {json.dumps({'content': item['content'], 'model': item['model'], 'model_index': item['model_index'], 'done': False})}\n\n"

                    # For parallel, don't save yet, wait for choice
                    yield f"data: {json.dumps({'content': '', 'done': True, 'parallel': True})}\n\n"
                else:
                    # Single mode
                    assistant_response = ""
                    chunk_count = 0

                    print(f"[DEBUG] Starting stream for model {model_name}")
                    for chunk in model_service.chat_stream(model_name, ollama_messages):
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
                    db.session.flush()  # Get the message ID without committing

                    # Generate TTS audio for assistant messages
                    print(f"[DEBUG] Generating TTS audio for message {assistant_message.id}")
                    speech_service = create_speech_service()
                    audio_url = speech_service.generate_message_audio(
                        assistant_message.id,
                        assistant_response,
                        language='tw',
                        speaker_id='twi_speaker_4'
                    )

                    if audio_url:
                        assistant_message.audio_url = audio_url
                        print(f"[DEBUG] TTS audio generated: {audio_url}")
                    else:
                        print("[DEBUG] TTS audio generation failed, continuing without audio")

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
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_file:
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

@chat_bp.route('/conversations/<conversation_id>/select_response', methods=['POST'])
@jwt_required()
def select_response(conversation_id):
    user_id = get_jwt_identity()
    conversation = Conversation.query.filter_by(id=conversation_id, user_id=user_id).first()

    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404

    data = request.get_json()
    query = data.get('query', '').strip()
    chosen_answer = data.get('chosen_answer', '').strip()
    model_used = data.get('model_used', '').strip()

    if not query or not chosen_answer or not model_used:
        return jsonify({"error": "Query, chosen_answer, and model_used are required"}), 400

    # Save to fine-tune data
    fine_tune_entry = FineTuneData(
        user_query=query,
        chosen_answer=chosen_answer,
        model_used=model_used,
        user_id=user_id
    )
    db.session.add(fine_tune_entry)
    db.session.commit()

    return jsonify({"message": "Response selected and saved for fine-tuning"}), 200

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

        # Check if file exists and has content
        if not os.path.exists(audio_path):
            return jsonify({"error": "Audio file was not created"}), 500

        file_size = os.path.getsize(audio_path)
        if file_size == 0:
            return jsonify({"error": "Audio file is empty"}), 500

        # Read the audio file and return as response
        with open(audio_path, 'rb') as audio_file:
            audio_data = audio_file.read()

        # Return audio data directly
        response = current_app.response_class(
            audio_data,
            mimetype='audio/wav',
            headers={
                'Content-Disposition': 'attachment; filename=speech.wav',
                'Content-Length': str(len(audio_data))
            }
        )
        return response

    except Exception as e:
        print(f"[TTS] Error: {str(e)}")
        import traceback
        traceback.print_exc()
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

    # Verify model is available in either service
    try:
        model_service = get_model_service(new_model)
    except ValueError:
        return jsonify({"error": f"Model {new_model} is not available"}), 400

    conversation.model_name = new_model
    db.session.commit()

    return jsonify({"message": f"Model changed to {new_model}"}), 200

@chat_bp.route('/audio/<filename>')
@jwt_required()
def serve_audio(filename):
    """Serve pre-generated audio files for messages"""
    try:
        from services.speech_service import create_speech_service
        speech_service = create_speech_service()
        audio_path = os.path.join(speech_service.audio_dir, filename)

        if not os.path.exists(audio_path):
            return jsonify({"error": "Audio file not found"}), 404

        return send_file(
            audio_path,
            mimetype='audio/wav',
            as_attachment=False  # Allow direct playback in browser
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500