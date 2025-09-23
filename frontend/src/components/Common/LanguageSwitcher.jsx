import React, { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../../context/LanguageContext';

const LanguageSwitcher = () => {
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = (languageCode) => {
    changeLanguage(languageCode);
    setIsOpen(false);
  };

  const currentLang = languages.find(lang => lang.code === currentLanguage);

  return (
    <div className="relative">
      <button
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{currentLang?.name}</span>
        <ChevronDownIcon
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-20 min-w-24">
          {languages.map((language) => (
            <button
              key={language.code}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 transition-colors ${
                language.code === currentLanguage
                  ? 'bg-orange-50 text-orange-900 font-medium'
                  : 'text-neutral-700'
              }`}
              onClick={() => handleLanguageChange(language.code)}
            >
              {language.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;