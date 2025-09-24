import React, { useState } from 'react';
import { ChatProvider } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import Sidebar from '../Sidebar/Sidebar';
import ChatArea from './ChatArea';

const ChatPage = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isDark } = useTheme();

  return (
    <ChatProvider>
      <div className={`h-screen flex ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
        {/* Fixed Sidebar */}
        <div className={`fixed left-0 top-0 h-screen ${sidebarCollapsed ? 'w-0 lg:w-16' : 'w-80'} z-10 transition-all duration-300 overflow-hidden`}>
          <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        </div>

        {/* Main Chat Area with left margin to account for fixed sidebar */}
        <div className={`flex-1 flex flex-col min-w-0 ${sidebarCollapsed ? 'ml-0 lg:ml-16' : 'ml-80'} transition-all duration-300`}>
          <ChatArea />
        </div>
      </div>
    </ChatProvider>
  );
};

export default ChatPage;