import React from 'react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { ChatSummary, FileMetadata } from '../types';

interface ChatHistoryPanelProps {
  chats: ChatSummary[];
  files: FileMetadata[];
  selectedChat: string | null;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
  onChatDeleted: () => void;
}

const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({
  chats,
  files,
  selectedChat,
  onChatSelect,
  onNewChat,
  onChatDeleted,
}) => {
  const [deletingChatId, setDeletingChatId] = React.useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [chatToDelete, setChatToDelete] = React.useState<{ id: string; title: string } | null>(null);
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

  // 파일이 존재하는지 확인
  const fileExists = (fileId: string) => {
    return files.some(f => f.file_id === fileId);
  };

  const handleChatDelete = (chatId: string, chatTitle: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setChatToDelete({ id: chatId, title: chatTitle });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!chatToDelete) return;

    try {
      setDeletingChatId(chatToDelete.id);
      const { chatApi } = await import('../services/api');
      await chatApi.delete(chatToDelete.id);
      setShowDeleteConfirm(false);
      setChatToDelete(null);
      onChatDeleted();
    } catch (error) {
      console.error('Chat deletion failed:', error);
      alert('대화 삭제에 실패했습니다.');
    } finally {
      setDeletingChatId(null);
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
            {chats.map((chat) => {
              const hasFile = fileExists(chat.file_id);
              return (
                <div
                  key={chat.chat_id}
                  className="w-full px-3 py-2.5 text-left transition-all duration-200 group"
                  style={{
                    backgroundColor: selectedChat === chat.chat_id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    borderLeft: selectedChat === chat.chat_id ? '4px solid var(--primary)' : '4px solid transparent',
                    boxShadow: selectedChat === chat.chat_id ? 'inset 0 0 0 1px rgba(59, 130, 246, 0.2)' : 'none',
                    opacity: hasFile ? 1 : 0.6,
                    cursor: 'pointer',
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
                  <div 
                    className="flex items-center justify-between gap-2"
                    onClick={() => onChatSelect(chat.chat_id)}
                  >
                    <div 
                      className="text-sm truncate flex-1 min-w-0 flex items-center gap-1"
                      style={{ color: 'var(--text)' }}
                    >
                      {!hasFile && (
                        <ExclamationTriangleIcon 
                          className="w-3.5 h-3.5 shrink-0" 
                          style={{ color: 'rgb(239, 68, 68)' }}
                          title="파일이 삭제됨"
                        />
                      )}
                      <span className="truncate">{chat.title}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div 
                        className="text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {formatDate(chat.updated_at)}
                      </div>
                      <button
                        onClick={(e) => handleChatDelete(chat.chat_id, chat.title, e)}
                        disabled={deletingChatId === chat.chat_id}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all duration-200"
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          color: 'rgb(239, 68, 68)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                        }}
                        title="대화 삭제"
                      >
                        {deletingChatId === chat.chat_id ? (
                          <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <XMarkIcon className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && chatToDelete && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)', zIndex: 10000 }}
        >
          <div
            className="relative w-full max-w-md p-6 rounded-xl"
            style={{
              backgroundColor: 'var(--background)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--border)',
            }}
          >
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>
              대화를 삭제하시겠습니까?
            </h3>
            <p className="text-sm mb-2" style={{ color: 'var(--text)' }}>
              <span className="font-semibold" style={{ color: 'var(--primary)' }}>
                {chatToDelete.title}
              </span>
            </p>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              삭제된 대화는 되돌릴 수 없습니다.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setChatToDelete(null);
                }}
                disabled={deletingChatId !== null}
                className="px-5 py-2.5 rounded-lg font-medium text-sm transition-all"
                style={{
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  cursor: deletingChatId !== null ? 'not-allowed' : 'pointer',
                  opacity: deletingChatId !== null ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (deletingChatId === null) {
                    e.currentTarget.style.backgroundColor = 'var(--border)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (deletingChatId === null) {
                    e.currentTarget.style.backgroundColor = 'var(--background-secondary)';
                  }
                }}
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingChatId !== null}
                className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
                style={{
                  background: deletingChatId !== null
                    ? 'rgba(239, 68, 68, 0.5)'
                    : 'linear-gradient(135deg, rgb(239, 68, 68) 0%, rgb(220, 38, 38) 100%)',
                  color: 'white',
                  boxShadow: deletingChatId !== null ? 'none' : '0 2px 8px rgba(239, 68, 68, 0.3)',
                  cursor: deletingChatId !== null ? 'not-allowed' : 'pointer',
                }}
              >
                {deletingChatId !== null && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {deletingChatId !== null ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHistoryPanel;