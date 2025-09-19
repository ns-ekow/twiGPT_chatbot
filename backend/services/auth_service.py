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