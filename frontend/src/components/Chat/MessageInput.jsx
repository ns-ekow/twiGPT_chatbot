import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useChat } from '../../context/ChatContext';
import Button from '../Common/Button';

const MessageInput = () => {
  const [message, setMessage] = useState('');
  const [rows, setRows] = useState(1);
  const textareaRef = useRef(null);

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
    }
  };

  const isDisabled = isStreaming || !message.trim();

  return (
    <div className="border-t border-neutral-200 bg-white">
      <div className="max-w-3xl mx-auto p-4">
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
                    ? "Type your message... (Enter to send, Shift+Enter for new line)"
                    : "Start a new conversation..."
                }
                disabled={isStreaming}
                className={`w-full px-4 py-3 pr-12 border border-neutral-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors ${
                  isStreaming ? 'bg-neutral-50 cursor-not-allowed' : 'bg-white'
                }`}
                rows={rows}
                style={{ minHeight: '52px', maxHeight: '200px' }}
              />

              <div className="absolute right-3 bottom-3">
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
            <div className="mt-2 text-sm text-orange-600 flex items-center space-x-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span>Assistant is thinking...</span>
            </div>
          )}

          <div className="mt-2 text-xs text-neutral-500 flex items-center justify-between">
            <span>
              {currentConversation ? (
                `Using ${currentConversation.model_name}`
              ) : (
                'Will create new conversation'
              )}
            </span>
            <span>
              Enter to send • Shift+Enter for new line
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MessageInput;