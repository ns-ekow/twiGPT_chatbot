import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    loadAvailableModels();
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const conversationsList = await apiService.getConversations();
      setConversations(conversationsList);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }, []);

  const loadAvailableModels = useCallback(async () => {
    try {
      const modelsData = await apiService.getAvailableModels();
      setAvailableModels(modelsData.models || []);
    } catch (error) {
      console.error('Error loading models:', error);
    }
  }, []);

  const createNewConversation = async (title = 'New Conversation', modelName = 'qwen3:latest') => {
    try {
      const newConversation = await apiService.createConversation(title, modelName);
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversation(newConversation);
      setMessages([]);
      return newConversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  };

  const selectConversation = async (conversationId) => {
    if (currentConversation?.id === conversationId) return;

    try {
      setIsLoading(true);
      const conversation = await apiService.getConversation(conversationId);
      setCurrentConversation(conversation);
      setMessages(conversation.messages || []);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (messageContent) => {
    if (!currentConversation || isStreaming) return;

    // Add user message immediately
    const userMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Add empty assistant message for streaming
    const assistantMessageId = `temp-assistant-${Date.now()}`;
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsStreaming(true);

    // Stream the response
    await apiService.sendMessage(
      currentConversation.id,
      messageContent,
      // onChunk
      (chunk) => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      },
      // onComplete
      (data) => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false, id: data.message_id || msg.id }
              : msg
          )
        );
        setIsStreaming(false);
        // Reload conversations to update timestamps
        loadConversations();
      },
      // onError
      (error) => {
        console.error('Streaming error:', error);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: `Error: ${error}`, isStreaming: false, error: true }
              : msg
          )
        );
        setIsStreaming(false);
      }
    );
  };

  const deleteConversation = async (conversationId) => {
    try {
      await apiService.deleteConversation(conversationId);
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));

      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const changeModel = async (conversationId, modelName) => {
    try {
      await apiService.changeConversationModel(conversationId, modelName);

      // Update the conversation in state
      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId ? { ...conv, model_name: modelName } : conv
        )
      );

      if (currentConversation?.id === conversationId) {
        setCurrentConversation(prev => ({ ...prev, model_name: modelName }));
      }
    } catch (error) {
      console.error('Error changing model:', error);
      throw error;
    }
  };

  const value = {
    conversations,
    currentConversation,
    messages,
    isLoading,
    isStreaming,
    availableModels,
    createNewConversation,
    selectConversation,
    sendMessage,
    deleteConversation,
    changeModel,
    loadConversations,
    loadAvailableModels,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};