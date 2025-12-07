import React from 'react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid';
import type { ChatSummary } from '../types';

interface ChatHistoryPanelProps {
  chats: ChatSummary[];
  selectedChat: string | null;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
}

const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({
  chats,
  selectedChat,
  onChatSelect,
  onNewChat,
}) => {
  const formatDate = (dateString: string) => {
    // UTC를 KST로 변환
    const date = new Date(dateString);
    const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    const now = new Date();
    const diff = now.getTime() - kstDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}분`;
    } else if (hours < 24) {
      return `${hours}시간`;
    } else {
      const days = Math.floor(hours / 24);
      if (days < 7) {
        return `${days}일`;
      } else {
        return kstDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      }
    }
  };

  return (
    <div 
      className="w-64 border-r flex flex-col"
      style={{
        backgroundColor: '#1a1f2e',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Header */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2">
          <ChatBubbleLeftRightIcon className="w-5 h-5" style={{ color: 'var(--primary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>대화 목록</span>
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div 
            className="flex flex-col items-center justify-center py-8 px-4 text-center"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ChatBubbleLeftRightIcon className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">대화 없음</p>
          </div>
        ) : (
          <div className="py-2">
            {chats.map((chat) => (
              <button
                key={chat.chat_id}
                onClick={() => onChatSelect(chat.chat_id)}
                className="w-full px-3 py-2.5 text-left transition-all duration-200"
                style={{
                  backgroundColor: selectedChat === chat.chat_id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  borderLeft: selectedChat === chat.chat_id ? '4px solid var(--primary)' : '4px solid transparent',
                  boxShadow: selectedChat === chat.chat_id ? 'inset 0 0 0 1px rgba(59, 130, 246, 0.2)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (selectedChat !== chat.chat_id) {
                    e.currentTarget.style.backgroundColor = 'var(--background)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedChat !== chat.chat_id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div 
                    className="text-sm truncate flex-1 min-w-0"
                    style={{ color: 'var(--text)' }}
                  >
                    {chat.title}
                  </div>
                  <div 
                    className="text-xs shrink-0"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {formatDate(chat.updated_at)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHistoryPanel;