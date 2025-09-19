import React, { useEffect, useRef } from 'react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useChat } from '../../context/ChatContext';
import Message from './Message';
import MessageInput from './MessageInput';
import LoadingSpinner from '../Common/LoadingSpinner';

const EmptyState = () => (
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="text-center max-w-md">
      <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <ChatBubbleLeftRightIcon className="w-8 h-8 text-orange-600" />
      </div>
      <h3 className="text-lg text-red-500 font-medium text-neutral-900 mb-2">
        Welcome to TwiGpt
      </h3>
      <p className="text-neutral-600 text-sm leading-relaxed">
        Start a conversation with your local AI assistant. Your data stays private
        and runs entirely on your machine using Ollama.
      </p>
      <div className="mt-6 p-4 bg-neutral-50 rounded-lg text-left">
        <h4 className="font-medium text-neutral-900 mb-2">Tips:</h4>
        <ul className="text-sm text-neutral-600 space-y-1">
          <li>• Ask questions, request explanations, or get help with code</li>
          <li>• Switch between different AI models anytime</li>
          <li>• All conversations are saved locally</li>
        </ul>
      </div>
    </div>
  </div>
);

const ChatArea = () => {
  const { currentConversation, messages, isLoading } = useChat();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-neutral-600">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (!currentConversation && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <EmptyState />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      {currentConversation && (
        <div className="border-b border-neutral-200 bg-white px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <h2 className="font-medium text-neutral-900 truncate">
                {currentConversation.title}
              </h2>
              <p className="text-sm text-neutral-500">
                {messages.length} messages • {currentConversation.model_name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto"
      >
        <div className="min-h-full">
          {messages.map((message, index) => (
            <Message
              key={message.id}
              message={message}
              isLast={index === messages.length - 1}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <MessageInput />
    </div>
  );
};

export default ChatArea;