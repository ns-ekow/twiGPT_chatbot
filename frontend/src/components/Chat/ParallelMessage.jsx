import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { formatDistanceToNow } from 'date-fns';
import {
  CpuChipIcon,
  CheckIcon,
  SpeakerWaveIcon,
  ClipboardIcon
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import api from '../../services/api';

const CodeBlock = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="relative group">
      <div className="flex items-center justify-between bg-neutral-800 px-4 py-2 rounded-t-lg">
        <span className="text-sm text-neutral-300 font-mono">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded text-xs transition-colors"
        >
          {copied ? (
            <>
              <CheckIcon className="w-3 h-3" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <ClipboardIcon className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

const ParallelMessage = ({ message1, message2, onSelect }) => {
  const isStreaming1 = message1.isStreaming;
  const isStreaming2 = message2.isStreaming;
  const hasError1 = message1.error;
  const hasError2 = message2.error;
  const [selected, setSelected] = useState(null);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);

  const formatTime = (timestamp) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'now';
    }
  };

  const handleSelect = (choice) => {
    setSelected(choice);
    onSelect(choice === 1 ? message1 : message2);
  };

  const handleTTS = async (content) => {
    setIsPlayingTTS(true);
    try {
      const response = await api.synthesizeText(
        content,
        'tw',
        'twi_speaker_4'
      );

      const audioBlob = new Blob([response.data], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsPlayingTTS(false);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setIsPlayingTTS(false);
        alert('Failed to play audio');
      };

      await audio.play();
    } catch (error) {
      console.error('TTS error:', error);
      alert('Failed to generate speech');
      setIsPlayingTTS(false);
    }
  };

  const renderContent = (message) => (
    <ReactMarkdown
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';

          if (!inline && language) {
            return (
              <CodeBlock
                language={language}
                value={String(children).replace(/\n$/, '')}
              />
            );
          }

          return (
            <code
              className="bg-neutral-100 text-orange-600 px-1 py-0.5 rounded text-sm font-mono"
              {...props}
            >
              {children}
            </code>
          );
        },
        pre({ children }) {
          return <>{children}</>;
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-4 border-orange-200 pl-4 my-4 text-neutral-700 italic">
              {children}
            </blockquote>
          );
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-neutral-200">
                {children}
              </table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th className="border border-neutral-200 bg-neutral-50 px-3 py-2 text-left font-medium">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="border border-neutral-200 px-3 py-2">
              {children}
            </td>
          );
        },
      }}
    >
      {message.content}
    </ReactMarkdown>
  );

  return (
    <div className="group px-4 py-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex space-x-4 mb-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-neutral-700">
            <CpuChipIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline space-x-2 mb-2">
              <span className="font-medium text-neutral-900">Assistant (Parallel Mode)</span>
              <span className="text-xs text-neutral-400">
                {formatTime(message1.timestamp)}
              </span>
              {(isStreaming1 || isStreaming2) && (
                <span className="text-xs text-orange-600 animate-pulse">
                  Thinking...
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-600 mb-4">Choose the response you prefer:</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Response 1 */}
          <div className={`border rounded-lg p-4 ${selected === 1 ? 'border-green-500 bg-green-50' : 'border-neutral-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm text-neutral-700">{message1.model}</span>
              <button
                onClick={() => handleSelect(1)}
                disabled={isStreaming1 || isStreaming2}
                className={`px-3 py-1 text-xs rounded ${
                  selected === 1
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {selected === 1 ? 'Selected' : 'Choose'}
              </button>
            </div>
            <div className={`prose prose-sm max-w-none ${hasError1 ? 'text-red-600' : 'text-neutral-900'}`}>
              {renderContent(message1)}
              {isStreaming1 && (
                <div className="flex items-center space-x-1 mt-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              )}
            </div>
            {!isStreaming1 && !hasError1 && (
              <button
                onClick={() => handleTTS(message1.content)}
                disabled={isPlayingTTS}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 disabled:text-neutral-400 flex items-center space-x-1"
              >
                <SpeakerWaveIcon className="w-3 h-3" />
                <span>{isPlayingTTS ? 'Playing...' : 'Play'}</span>
              </button>
            )}
          </div>

          {/* Response 2 */}
          <div className={`border rounded-lg p-4 ${selected === 2 ? 'border-green-500 bg-green-50' : 'border-neutral-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm text-neutral-700">{message2.model}</span>
              <button
                onClick={() => handleSelect(2)}
                disabled={isStreaming1 || isStreaming2}
                className={`px-3 py-1 text-xs rounded ${
                  selected === 2
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {selected === 2 ? 'Selected' : 'Choose'}
              </button>
            </div>
            <div className={`prose prose-sm max-w-none ${hasError2 ? 'text-red-600' : 'text-neutral-900'}`}>
              {renderContent(message2)}
              {isStreaming2 && (
                <div className="flex items-center space-x-1 mt-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              )}
            </div>
            {!isStreaming2 && !hasError2 && (
              <button
                onClick={() => handleTTS(message2.content)}
                disabled={isPlayingTTS}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 disabled:text-neutral-400 flex items-center space-x-1"
              >
                <SpeakerWaveIcon className="w-3 h-3" />
                <span>{isPlayingTTS ? 'Playing...' : 'Play'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParallelMessage;