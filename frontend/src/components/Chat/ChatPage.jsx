import React from 'react';
import { ChatProvider } from '../../context/ChatContext';
import Sidebar from '../Sidebar/Sidebar';
import ChatArea from './ChatArea';

const ChatPage = () => {
  return (
    <ChatProvider>
      <div className="h-screen flex bg-white">
        {/* Fixed Sidebar */}
        <div className="fixed left-0 top-0 h-screen w-80 z-10">
          <Sidebar />
        </div>

        {/* Main Chat Area with left margin to account for fixed sidebar */}
        <div className="flex-1 flex flex-col min-w-0 ml-80">
          <ChatArea />
        </div>
      </div>
    </ChatProvider>
  );
};

export default ChatPage;