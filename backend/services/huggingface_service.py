from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
import torch
from typing import Generator, Dict, Any, List

class HuggingFaceService:
    def __init__(self):
        self.models = {}
        self._load_available_models()

    def _load_available_models(self):
        """Load predefined Hugging Face models"""
        # Add your models here
        self.models["FelixYaw/twi-gpt-lora-kaggle"] = {
            'name': "FelixYaw/twi-gpt-lora-kaggle",
            'size': 0,  # You can estimate or leave as 0
            'modified_at': '',
            'tokenizer': None,
            'model': None
        }
        self.models["FelixYaw/twi-lora-model"] = {
            'name': "FelixYaw/twi-lora-model",
            'size': 0,  # You can estimate or leave as 0
            'modified_at': '',
            'tokenizer': None,
            'model': None,
            'peft_base': "FelixYaw/twi-model"
        }

    def get_available_models(self) -> Dict[str, Any]:
        """Get list of available Hugging Face models"""
        return self.models

    def _load_model(self, model_name: str):
        """Lazy load model and tokenizer"""
        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not available")

        if self.models[model_name]['model'] is None:
            print(f"Loading Hugging Face model: {model_name}")
            self.models[model_name]['tokenizer'] = AutoTokenizer.from_pretrained(model_name)

            # Check if this is a PEFT model
            if 'peft_base' in self.models[model_name]:
                base_model_name = self.models[model_name]['peft_base']
                print(f"Loading PEFT model with base: {base_model_name}")
                base_model = AutoModelForCausalLM.from_pretrained(base_model_name)
                self.models[model_name]['model'] = PeftModel.from_pretrained(base_model, model_name)
            else:
                self.models[model_name]['model'] = AutoModelForCausalLM.from_pretrained(model_name)

            # Move to GPU if available
            if torch.cuda.is_available():
                self.models[model_name]['model'] = self.models[model_name]['model'].cuda()

    def chat_stream(self, model: str, messages: List[Dict[str, str]],
                   system_message: str = None) -> Generator[str, None, None]:
        """Stream chat completion from Hugging Face model"""
        try:
            self._load_model(model)
            tokenizer = self.models[model]['tokenizer']
            model_obj = self.models[model]['model']

            # Prepare input text
            conversation = ""
            if system_message:
                conversation += f"System: {system_message}\n"

            for msg in messages:
                role = msg["role"]
                content = msg["content"]
                conversation += f"{role.capitalize()}: {content}\n"

            conversation += "Assistant: "

            # Tokenize input
            inputs = tokenizer(conversation, return_tensors="pt")
            if torch.cuda.is_available():
                inputs = {k: v.cuda() for k, v in inputs.items()}

            # Generate response
            with torch.no_grad():
                output = model_obj.generate(
                    **inputs,
                    max_new_tokens=100,  # Adjust as needed
                    temperature=0.8,
                    top_p=0.9,
                    do_sample=True,
                    pad_token_id=tokenizer.eos_token_id
                )

            # Decode the full response
            full_response = tokenizer.decode(output[0], skip_special_tokens=True)

            # Extract only the new part (after the input)
            new_response = full_response[len(conversation):].strip()

            # Yield chunks for streaming
            for char in new_response:
                yield char

        except Exception as e:
            yield f"Error: {str(e)}"

    def chat_complete(self, model: str, messages: List[Dict[str, str]],
                     system_message: str = None) -> str:
        """Get complete chat response from Hugging Face model"""
        response_parts = []
        for chunk in self.chat_stream(model, messages, system_message):
            response_parts.append(chunk)
        return ''.join(response_parts)

    def is_model_available(self, model_name: str) -> bool:
        """Check if a model is available"""
        return model_name in self.models

# Model factory function
def create_huggingface_service() -> HuggingFaceService:
    """Factory function to create HuggingFaceService instance"""
    return HuggingFaceService()