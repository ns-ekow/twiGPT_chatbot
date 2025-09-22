import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3030/api';

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

  async createConversation(title = 'New Conversation', modelName = 'qwen3:latest') {
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
  async changeConversationModel(conversationId, modelName) {
    const response = await this.api.put(`/chat/conversations/${conversationId}/model`, {
      model_name: modelName,
    });
    return response.data;
  }

  // ASR endpoint
  async transcribeAudio(audioBlob, language = 'tw') {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('language', language);

    const response = await this.api.post('/chat/asr', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // TTS endpoint
  async synthesizeText(text, language = 'tw', speakerId = 'twi_speaker_4') {
    const response = await this.api.post('/chat/tts', {
      text,
      language,
      speaker_id: speakerId
    }, {
      responseType: 'blob'
    });
    return response;
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