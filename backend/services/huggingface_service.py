from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
import torch
from typing import Generator, Dict, Any, List
import threading
import time
import logging

logger = logging.getLogger(__name__)

class HuggingFaceService:
    def __init__(self):
        self.models = {}
        self.loading_status = {}  # Track loading status: 'not_started', 'loading', 'loaded', 'failed'
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

        # Initialize loading status for all models
        for model_name in self.models:
            self.loading_status[model_name] = 'not_started'

    def get_available_models(self) -> Dict[str, Any]:
        """Get list of available Hugging Face models"""
        return self.models

    def preload_models(self, model_names: List[str]):
        """Pre-load specified models in background"""
        def load_worker():
            for model_name in model_names:
                if model_name in self.models:
                    try:
                        logger.info(f"Pre-loading model: {model_name}")
                        self._load_model(model_name)
                        # Small delay between loads to prevent memory spikes
                        time.sleep(2)
                    except Exception as e:
                        logger.error(f"Failed to pre-load model {model_name}: {str(e)}")
                else:
                    logger.warning(f"Model {model_name} not available for pre-loading")

        # Start background loading thread
        loading_thread = threading.Thread(target=load_worker, daemon=True)
        loading_thread.start()
        logger.info(f"Started background pre-loading for models: {model_names}")

    def get_loading_status(self) -> Dict[str, str]:
        """Get loading status for all models"""
        return self.loading_status.copy()

    def _load_model(self, model_name: str):
        """Lazy load model and tokenizer"""
        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not available")

        if self.models[model_name]['model'] is None:
            self.loading_status[model_name] = 'loading'
            try:
                logger.info(f"Loading Hugging Face model: {model_name}")
                self.models[model_name]['tokenizer'] = AutoTokenizer.from_pretrained(model_name)

                # Check if this is a PEFT model
                if 'peft_base' in self.models[model_name]:
                    base_model_name = self.models[model_name]['peft_base']
                    logger.info(f"Loading PEFT model with base: {base_model_name}")
                    base_model = AutoModelForCausalLM.from_pretrained(base_model_name)
                    self.models[model_name]['model'] = PeftModel.from_pretrained(base_model, model_name)
                else:
                    self.models[model_name]['model'] = AutoModelForCausalLM.from_pretrained(model_name)

                # Move to GPU if available
                if torch.cuda.is_available():
                    self.models[model_name]['model'] = self.models[model_name]['model'].cuda()

                self.loading_status[model_name] = 'loaded'
                logger.info(f"Successfully loaded model: {model_name}")
            except Exception as e:
                self.loading_status[model_name] = 'failed'
                logger.error(f"Failed to load model {model_name}: {str(e)}")
                raise

    def _filter_assistant_response(self, response: str) -> str:
        """Filter response to extract only the first Assistant response and avoid repetitions"""
        # Find the first "Assistant:" occurrence
        assistant_start = response.find("Assistant:")
        if assistant_start == -1:
            return response.strip()

        # Extract from "Assistant:" onwards
        assistant_response = response[assistant_start + len("Assistant:"):].strip()

        # Find the next "Assistant:" to cut off repetitions
        next_assistant = assistant_response.find("Assistant:")
        if next_assistant != -1:
            assistant_response = assistant_response[:next_assistant].strip()

        # Cut at the first full stop (period) for concise responses
        first_period = assistant_response.find(".")
        if first_period != -1:
            assistant_response = assistant_response[:first_period + 1].strip()

        return assistant_response

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
                    temperature=0.7,
                    top_p=0.9,
                    do_sample=True,
                    pad_token_id=tokenizer.eos_token_id
                )

            # Decode the full response
            full_response = tokenizer.decode(output[0], skip_special_tokens=True)

            # Extract only the new part (after the input)
            new_response = full_response[len(conversation):].strip()

            # Filter out repetitions for cleaner response
            filtered_response = self._filter_assistant_response(new_response)

            # Yield chunks for streaming
            for char in filtered_response:
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