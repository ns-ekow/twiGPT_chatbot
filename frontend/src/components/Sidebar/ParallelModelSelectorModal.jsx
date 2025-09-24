import React from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Button from '../Common/Button';

const ParallelModelSelectorModal = ({ isOpen, onClose, availableModels, currentModel, selectedSecondModel, onSelectSecondModel }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const filteredModels = availableModels.filter(model => model.name !== currentModel);

  const handleSelect = (model) => {
    onSelectSecondModel(model);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h3 className="text-lg font-medium text-neutral-900">
            Select Second Model for Parallel Mode
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-neutral-600 mb-4">
            Choose a second model to compare responses with {currentModel}.
          </p>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {filteredModels.map((model) => (
              <button
                key={model.name}
                onClick={() => handleSelect(model.name)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                  selectedSecondModel === model.name
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                <span className="font-medium">{model.name}</span>
              </button>
            ))}
          </div>

          {filteredModels.length === 0 && (
            <p className="text-sm text-neutral-500 text-center py-4">
              No other models available.
            </p>
          )}
        </div>

        <div className="flex justify-end space-x-3 p-4 border-t border-neutral-200">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ParallelModelSelectorModal;