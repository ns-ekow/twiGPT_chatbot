import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon, CpuChipIcon } from '@heroicons/react/24/outline';
import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import Button from '../Common/Button';

const ModelSelector = () => {
  const { t } = useTranslation();
  const { currentConversation, availableModels, changeModel } = useChat();
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  const handleModelChange = async (modelName) => {
    if (!currentConversation || modelName === currentConversation.model_name) {
      setIsOpen(false);
      return;
    }

    setIsChanging(true);
    try {
      await changeModel(currentConversation.id, modelName);
    } catch (error) {
      console.error('Failed to change model:', error);
    } finally {
      setIsChanging(false);
      setIsOpen(false);
    }
  };

  if (!currentConversation) {
    return null;
  }

  const currentModel = availableModels.find(
    model => model.name === currentConversation.model_name
  ) || { name: currentConversation.model_name };

  return (
    <div className="relative">
      <button
        className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors ${isDark ? 'bg-neutral-800 border-neutral-600 hover:bg-neutral-700' : 'bg-white border-neutral-200 hover:bg-neutral-50'}`}
        onClick={() => setIsOpen(!isOpen)}
        disabled={isChanging}
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isDark ? 'bg-orange-900' : 'bg-orange-100'}`}>
            <CpuChipIcon className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
          </div>
          <div className="text-left">
            <p className={`font-medium truncate ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
              {currentModel.name}
            </p>
            <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              {isChanging ? t('changing') : t('currentModel')}
            </p>
          </div>
        </div>
        <ChevronDownIcon
          className={`w-4 h-4 transition-transform ${isDark ? 'text-neutral-500' : 'text-neutral-400'} ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className={`absolute top-full left-0 right-0 mt-1 border rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto ${isDark ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-200'}`}>
          <div className="p-2">
            <p className={`text-xs font-medium uppercase tracking-wide px-2 py-1 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              {t('availableModels')}
            </p>
            {availableModels.map((model) => (
              <button
                key={model.name}
                className={`w-full text-left p-2 rounded transition-colors ${
                  model.name === currentConversation.model_name
                    ? `${isDark ? 'bg-orange-900 text-orange-100' : 'bg-orange-50 text-orange-900'}`
                    : `${isDark ? 'text-neutral-300 hover:bg-neutral-700' : 'text-neutral-700 hover:bg-neutral-50'}`
                }`}
                onClick={() => handleModelChange(model.name)}
              >
                <div className="font-mono text-sm">{model.name}</div>
                {model.size && (
                  <div className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    {(model.size / (1024 * 1024 * 1024)).toFixed(1)} GB
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;