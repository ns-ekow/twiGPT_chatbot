import React, { useState } from 'react';
import { ChevronDownIcon, CpuChipIcon } from '@heroicons/react/24/outline';
import { useChat } from '../../context/ChatContext';
import Button from '../Common/Button';

const ModelSelector = () => {
  const { currentConversation, availableModels, changeModel } = useChat();
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
        className="w-full flex items-center justify-between p-3 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isChanging}
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <CpuChipIcon className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-neutral-900 truncate">
              {currentModel.name}
            </p>
            <p className="text-xs text-neutral-500">
              {isChanging ? 'Changing...' : 'Current model'}
            </p>
          </div>
        </div>
        <ChevronDownIcon
          className={`w-4 h-4 text-neutral-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
          <div className="p-2">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide px-2 py-1">
              Available Models
            </p>
            {availableModels.map((model) => (
              <button
                key={model.name}
                className={`w-full text-left p-2 rounded hover:bg-neutral-50 transition-colors ${
                  model.name === currentConversation.model_name
                    ? 'bg-orange-50 text-orange-900'
                    : 'text-neutral-700'
                }`}
                onClick={() => handleModelChange(model.name)}
              >
                <div className="font-mono text-sm">{model.name}</div>
                {model.size && (
                  <div className="text-xs text-neutral-500">
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