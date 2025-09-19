import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ChatBubbleLeftIcon,
  TrashIcon,
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline';
import { useChat } from '../../context/ChatContext';
import Button from '../Common/Button';

const ConversationItem = ({ conversation, isActive, onClick, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await onDelete(conversation.id);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    } finally {
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div
      className={`group relative p-3 rounded-lg cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-orange-50 border-l-4 border-orange-500'
          : 'hover:bg-neutral-50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <div className={`p-2 rounded-lg ${isActive ? 'bg-orange-100' : 'bg-neutral-100'}`}>
            <ChatBubbleLeftIcon className="w-4 h-4 text-neutral-600" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className={`font-medium truncate ${
              isActive ? 'text-orange-900' : 'text-neutral-900'
            }`}>
              {conversation.title}
            </h3>

            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-neutral-500">
                {conversation.message_count} messages
              </p>
              <p className="text-xs text-neutral-400">
                {formatDate(conversation.updated_at)}
              </p>
            </div>

            <div className="mt-1">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${
                isActive ? 'bg-orange-100 text-orange-800' : 'bg-neutral-100 text-neutral-600'
              }`}>
                {conversation.model_name}
              </span>
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-neutral-200 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            <EllipsisHorizontalIcon className="w-4 h-4 text-neutral-600" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
              <button
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <TrashIcon className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ConversationList = () => {
  const { conversations, currentConversation, selectConversation, deleteConversation } = useChat();

  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-neutral-500">
        <ChatBubbleLeftIcon className="w-12 h-12 mx-auto mb-2 text-neutral-300" />
        <p className="text-sm">No conversations yet</p>
        <p className="text-xs mt-1">Start a new chat to begin</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          isActive={currentConversation?.id === conversation.id}
          onClick={() => selectConversation(conversation.id)}
          onDelete={deleteConversation}
        />
      ))}
    </div>
  );
};

export default ConversationList;