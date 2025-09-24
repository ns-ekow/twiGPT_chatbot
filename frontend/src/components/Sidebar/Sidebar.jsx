import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  ArrowRightOnRectangleIcon,
  UserIcon,
  Cog6ToothIcon,
  Bars3Icon,
  SunIcon,
  MoonIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import ConversationList from './ConversationList';
import ModelSelector from './ModelSelector';
import ParallelModelSelectorModal from './ParallelModelSelectorModal';
import LanguageSwitcher from '../Common/LanguageSwitcher';
import Button from '../Common/Button';

const Sidebar = ({ collapsed, onToggle }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { createNewConversation, parallelMode, setParallelMode, availableModels, currentConversation, secondModel, setSecondModel } = useChat();
  const { isDark, toggleTheme } = useTheme();
  const [showModal, setShowModal] = useState(false);

  const handleNewChat = async () => {
    try {
      await createNewConversation();
    } catch (error) {
      console.error('Failed to create new conversation:', error);
    }
  };

  const handleParallelToggle = (checked) => {
    if (checked) {
      setShowModal(true);
    } else {
      setParallelMode(false);
    }
  };

  const handleSelectSecondModel = (model) => {
    setSecondModel(model);
    setParallelMode(true);
    setShowModal(false);
  };

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-neutral-800' : 'bg-neutral-50'} border-r ${isDark ? 'border-neutral-700' : 'border-neutral-200'}`}>
      {/* Header */}
      <div className={`p-4 border-b ${isDark ? 'border-neutral-700' : 'border-neutral-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onToggle}
              className={`p-2 text-neutral-400 hover:text-neutral-600 rounded-lg transition-colors ${isDark ? 'hover:bg-neutral-700' : 'hover:bg-neutral-100'}`}
            >
              <Bars3Icon className="w-5 h-5" />
            </button>
            <button
              onClick={toggleTheme}
              className={`p-2 text-neutral-400 hover:text-neutral-600 rounded-lg transition-colors ${isDark ? 'hover:bg-neutral-700' : 'hover:bg-neutral-100'}`}
            >
              {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
            {!collapsed && (
              <>
                <h1 className={`text-xl font-bold ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
                  {t('appName')}
                </h1>
                <LanguageSwitcher />
              </>
            )}
          </div>
          
        </div>

        {!collapsed && (
          <>
            <ModelSelector />

            {/* Parallel Mode Toggle */}
            <div className="px-4 py-2">
              {!collapsed && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleNewChat}
              className="flex items-center space-x-1 mb-2 w-full"
            >
              <PlusIcon className="w-4 h-4" />
              <span>{t('newChat')}</span>
            </Button>
          )}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={parallelMode}
                  onChange={(e) => handleParallelToggle(e.target.checked)}
                  className="w-4 h-4 text-orange-600 bg-neutral-100 border-neutral-300 rounded focus:ring-orange-500 focus:ring-2"
                />
                <span className="text-sm text-neutral-700">{t('parallelMode')}</span>
              </label>
            </div>
          </>
        )}
      </div>

      {/* Conversation List */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto min-h-0">
          <ConversationList />
        </div>
      )}

      {/* Footer */}
      {!collapsed && (
        <div className={`p-4 border-t ${isDark ? 'border-neutral-700 bg-neutral-700' : 'border-neutral-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${isDark ? 'bg-neutral-600' : 'bg-neutral-100'}`}>
                <UserIcon className={`w-4 h-4 ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`} />
              </div>
              <div>
                <p className={`font-medium text-sm ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
                  {user?.username}
                </p>
                <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  {user?.email}
                </p>
              </div>
            </div>

            <div className="flex space-x-1">
              <button className={`p-2 text-neutral-400 hover:text-neutral-600 rounded-lg transition-colors ${isDark ? 'hover:bg-neutral-700' : 'hover:bg-neutral-100'}`}>
                <Cog6ToothIcon className="w-4 h-4" />
              </button>
              <button
                className={`p-2 text-neutral-400 hover:text-neutral-600 rounded-lg transition-colors ${isDark ? 'hover:bg-neutral-700' : 'hover:bg-neutral-100'}`}
                onClick={logout}
                title={t('signOut')}
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <ParallelModelSelectorModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        availableModels={availableModels}
        currentModel={currentConversation?.model_name}
        selectedSecondModel={secondModel}
        onSelectSecondModel={handleSelectSecondModel}
      />
    </div>
  );
};

export default Sidebar;