import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PaperAirplaneIcon, MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline';
import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import Button from '../Common/Button';
import api from '../../services/api';

const MessageInput = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [message, setMessage] = useState('');
  const [rows, setRows] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const { currentConversation, sendMessage, isStreaming, createNewConversation } = useChat();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // Max height in pixels
      const newHeight = Math.min(scrollHeight, maxHeight);
      textareaRef.current.style.height = `${newHeight}px`;

      // Calculate rows based on line height (approximately 24px per line)
      const newRows = Math.min(Math.max(Math.ceil(scrollHeight / 24), 1), 8);
      setRows(newRows);
    }
  }, [message]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!message.trim() || isStreaming) return;

    // If no conversation exists, create one
    let conversation = currentConversation;
    if (!conversation) {
      try {
        conversation = await createNewConversation();
      } catch (error) {
        console.error('Failed to create conversation:', error);
        return;
      }
    }

    const messageToSend = message.trim();
    setMessage('');

    try {
      await sendMessage(messageToSend);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore message on error
      setMessage(messageToSend);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Tab') {
      const textarea = textareaRef.current;
      if (textarea) {
        const pos = textarea.selectionStart;
        if (pos > 0) {
          const char = message[pos - 1];
          if (char === 'e') {
            e.preventDefault();
            const newMessage = message.slice(0, pos - 1) + 'ɛ' + message.slice(pos);
            setMessage(newMessage);
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = pos;
            }, 0);
          } else if (char === 'o') {
            e.preventDefault();
            const newMessage = message.slice(0, pos - 1) + 'ɔ' + message.slice(pos);
            setMessage(newMessage);
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = pos;
            }, 0);
          }
        }
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert(t('microphoneError'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob) => {
    setIsProcessingAudio(true);
    try {
      const response = await api.transcribeAudio(audioBlob, 'tw');

      if (response.text) {
        setMessage(response.text);
        textareaRef.current?.focus();
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      alert(t('transcriptionError'));
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const isDisabled = isStreaming || !message.trim() || isProcessingAudio;

  const insertSpecialChar = (char) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.slice(0, start) + char + message.slice(end);
      setMessage(newMessage);
      // Set cursor after inserted char
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
        textarea.focus();
      }, 0);
    }
  };

  return (
    <div className={`border-t ${isDark ? 'border-neutral-700 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
      <div className="max-w-3xl mx-auto p-4">
        {/* Special Characters Pill */}
        <div className="mb-2 flex justify-center">
          <div className={`flex space-x-1 rounded-full px-3 py-1 ${isDark ? 'bg-neutral-700' : 'bg-neutral-100'}`}>
            <button
              type="button"
              onClick={() => insertSpecialChar('ɛ')}
              className={`px-2 py-1 text-sm font-medium rounded transition-colors ${isDark ? 'text-neutral-300 hover:bg-neutral-600' : 'text-neutral-700 hover:bg-neutral-200'}`}
            >
              ɛ
            </button>
            <button
              type="button"
              onClick={() => insertSpecialChar('ɔ')}
              className={`px-2 py-1 text-sm font-medium rounded transition-colors ${isDark ? 'text-neutral-300 hover:bg-neutral-600' : 'text-neutral-700 hover:bg-neutral-200'}`}
            >
              ɔ
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-end space-x-3">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  currentConversation
                    ? t('typeMessage')
                    : t('startConversation')
                }
                disabled={isStreaming}
                className={`w-full px-4 py-3 pr-12 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors ${
                  isStreaming ? `${isDark ? 'bg-neutral-700' : 'bg-neutral-50'} cursor-not-allowed` : `${isDark ? 'bg-neutral-800' : 'bg-white'}`
                } ${isDark ? 'border-neutral-600' : 'border-neutral-300'}`}
                rows={rows}
                style={{ minHeight: '40px', maxHeight: '200px' }}
              />

              <div className="absolute right-3 bottom-3 flex space-x-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isStreaming || isProcessingAudio}
                  className={`p-2 ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                >
                  {isRecording ? (
                    <StopIcon className="w-4 h-4" />
                  ) : (
                    <MicrophoneIcon className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isDisabled}
                  className="p-2"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {isStreaming && (
            <div className={`mt-2 text-sm flex items-center space-x-2 ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span>{t('assistantThinking')}</span>
            </div>
          )}

          {isProcessingAudio && (
            <div className={`mt-2 text-sm flex items-center space-x-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>{t('processingAudio')}</span>
            </div>
          )}

          <div className={`mt-2 text-xs flex items-center justify-between ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            <span>
              {currentConversation ? (
                `${t('usingModel')} ${currentConversation.model_name}`
              ) : (
                t('willCreateConversation')
              )}
            </span>
            <span>
              {t('sendInstructions')}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MessageInput;