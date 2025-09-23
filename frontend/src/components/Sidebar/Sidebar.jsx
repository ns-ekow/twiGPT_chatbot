import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  ArrowRightOnRectangleIcon,
  UserIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import ConversationList from './ConversationList';
import ModelSelector from './ModelSelector';
import LanguageSwitcher from '../Common/LanguageSwitcher';
import Button from '../Common/Button';

const Sidebar = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { createNewConversation } = useChat();

  const handleNewChat = async () => {
    try {
      await createNewConversation();
    } catch (error) {
      console.error('Failed to create new conversation:', error);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-50 border-r border-neutral-200">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold text-neutral-900">
              {t('appName')}
            </h1>
            <LanguageSwitcher />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleNewChat}
            className="flex items-center space-x-1"
          >
            <PlusIcon className="w-4 h-4" />
            <span>{t('newChat')}</span>
          </Button>
        </div>

        <ModelSelector />
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <ConversationList />
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-neutral-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-neutral-100 rounded-full">
              <UserIcon className="w-4 h-4 text-neutral-600" />
            </div>
            <div>
              <p className="font-medium text-neutral-900 text-sm">
                {user?.username}
              </p>
              <p className="text-xs text-neutral-500">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="flex space-x-1">
            <button className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
              <Cog6ToothIcon className="w-4 h-4" />
            </button>
            <button
              className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
              onClick={logout}
              title={t('signOut')}
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;