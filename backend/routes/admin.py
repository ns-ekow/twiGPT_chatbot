from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, create_access_token, get_jwt
from database import db, User, Conversation, Message, FineTuneData
from datetime import datetime
import csv
import io

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if username == 'admin' and password == 'twigptadmin123':
        # Create admin token
        access_token = create_access_token(identity='admin', additional_claims={'role': 'admin'})
        return jsonify({'access_token': access_token}), 200
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

@admin_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    # Check if admin
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    user_count = User.query.count()
    conversation_count = Conversation.query.count()
    message_count = Message.query.count()
    fine_tune_count = FineTuneData.query.count()

    return jsonify({
        'user_count': user_count,
        'conversation_count': conversation_count,
        'message_count': message_count,
        'fine_tune_count': fine_tune_count
    }), 200

@admin_bp.route('/fine-tune-data', methods=['GET'])
@jwt_required()
def get_fine_tune_data():
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = FineTuneData.query.order_by(FineTuneData.timestamp.desc()).all()
    return jsonify([{
        'id': item.id,
        'user_query': item.user_query,
        'chosen_answer': item.chosen_answer,
        'model_used': item.model_used,
        'user_id': item.user_id,
        'timestamp': item.timestamp.isoformat()
    } for item in data]), 200

@admin_bp.route('/export-csv', methods=['GET'])
@jwt_required()
def export_csv():
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = FineTuneData.query.order_by(FineTuneData.timestamp.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'User Query', 'Chosen Answer', 'Model Used', 'User ID', 'Timestamp'])

    for item in data:
        writer.writerow([
            item.id,
            item.user_query,
            item.chosen_answer,
            item.model_used,
            item.user_id,
            item.timestamp.isoformat()
        ])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=fine_tune_data.csv'}
    )