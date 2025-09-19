import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { formatDistanceToNow } from 'date-fns';
import {
  UserIcon,
  CpuChipIcon,
  ClipboardIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useState } from 'react';

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

const Message = ({ message, isLast = false }) => {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;
  const hasError = message.error;

  const formatTime = (timestamp) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'now';
    }
  };

  return (
    <div className={`group px-4 py-6 ${isUser ? 'bg-neutral-50' : 'bg-white'}`}>
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
              <span className="font-medium text-neutral-900">
                {isUser ? 'You' : 'Assistant'}
              </span>
              <span className="text-xs text-neutral-400">
                {formatTime(message.timestamp)}
              </span>
              {isStreaming && (
                <span className="text-xs text-orange-600 animate-pulse">
                  Thinking...
                </span>
              )}
            </div>

            <div className={`prose prose-sm max-w-none ${
              hasError ? 'text-red-600' : 'text-neutral-900'
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