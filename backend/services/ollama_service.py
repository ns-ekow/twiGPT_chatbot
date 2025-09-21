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
                timeout=300
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