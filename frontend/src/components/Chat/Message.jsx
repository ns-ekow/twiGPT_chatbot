import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { formatDistanceToNow } from 'date-fns';
import {
  UserIcon,
  CpuChipIcon,
  ClipboardIcon,
  CheckIcon,
  SpeakerWaveIcon
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import api from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

const Message = ({ message, isLast = false }) => {
  const { isDark } = useTheme();
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;
  const hasError = message.error;
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const hasPreGeneratedAudio = message.audio_url && !isUser;

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
        <div className={`flex items-center justify-between px-4 py-2 rounded-t-lg ${isDark ? 'bg-neutral-800' : 'bg-neutral-200'}`}>
          <span className={`text-sm font-mono ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
            {language || 'code'}
          </span>
          <button
            onClick={handleCopy}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${isDark ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300' : 'bg-neutral-300 hover:bg-neutral-400 text-neutral-700'}`}
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
          style={isDark ? oneDark : oneLight}
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

  const formatTime = (timestamp) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'now';
    }
  };

  const handleTTS = async () => {
    if (isUser || isStreaming || hasError) return;

    setIsPlayingTTS(true);
    try {
      const response = await api.synthesizeText(
        message.content,
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

  return (
    <div className={`group px-4 py-6 ${isUser ? 'bg-neutral-50 dark:bg-neutral-800' : 'bg-white dark:bg-neutral-900'}`}>
      <div className="max-w-3xl mx-auto">
        <div className="flex space-x-4">
          {/* Avatar */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser
              ? 'bg-orange-500'
              : hasError
                ? 'bg-red-500'
                : 'bg-neutral-700'
          }`}>
            {isUser ? (
              <UserIcon className="w-5 h-5 text-white" />
            ) : (
              <CpuChipIcon className="w-5 h-5 text-white" />
            )}
          </div>

          {/* Message Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline space-x-2 mb-2">
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {isUser ? 'You' : 'Assistant'}
              </span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                {formatTime(message.timestamp)}
              </span>
              {!isUser && !isStreaming && !hasError && (
                hasPreGeneratedAudio ? (
                  <audio
                    controls
                    className="h-6 w-32"
                    preload="none"
                    title="Listen to response"
                  >
                    <source src={message.audio_url} type="audio/wav" />
                    Your browser does not support the audio element.
                  </audio>
                ) : (
                  <button
                    onClick={handleTTS}
                    disabled={isPlayingTTS}
                    className="text-xs text-blue-600 hover:text-blue-800 disabled:text-neutral-400 flex items-center space-x-1"
                    title="Listen to response"
                  >
                    <SpeakerWaveIcon className="w-3 h-3" />
                    <span>{isPlayingTTS ? 'Playing...' : 'Play'}</span>
                  </button>
                )
              )}
              {isStreaming && (
                <span className="text-xs text-orange-600 animate-pulse">
                  Thinking...
                </span>
              )}
            </div>

            <div className={`prose prose-sm max-w-none ${
              hasError ? 'text-red-600 dark:text-red-400' : 'text-neutral-900 dark:text-neutral-100'
            }`}>
              {isUser ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
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
                          className="bg-neutral-100 dark:bg-neutral-800 text-orange-600 dark:text-orange-400 px-1 py-0.5 rounded text-sm font-mono"
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
                        <blockquote className="border-l-4 border-orange-200 dark:border-orange-700 pl-4 my-4 text-neutral-700 dark:text-neutral-300 italic">
                          {children}
                        </blockquote>
                      );
                    },
                    table({ children }) {
                      return (
                        <div className="overflow-x-auto my-4">
                          <table className="min-w-full border-collapse border border-neutral-200 dark:border-neutral-700">
                            {children}
                          </table>
                        </div>
                      );
                    },
                    th({ children }) {
                      return (
                        <th className="border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-3 py-2 text-left font-medium text-neutral-900 dark:text-neutral-100">
                          {children}
                        </th>
                      );
                    },
                    td({ children }) {
                      return (
                        <td className="border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-neutral-900 dark:text-neutral-100">
                          {children}
                        </td>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}

              {isStreaming && isLast && (
                <div className="flex items-center space-x-1 mt-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Message;