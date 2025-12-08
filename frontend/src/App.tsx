import { useState, useEffect } from 'react';
import './App.css';
import ChatHistoryPanel from './components/ChatHistoryPanel';
import ChatPanel from './components/ChatPanel';
import FileListPanel from './components/FileListPanel';
import Header from './components/Header';
import type { FileMetadata, ChatSummary } from './types';
import { filesApi, chatApi } from './services/api';

function App() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [filesData, chatsData] = await Promise.all([
        filesApi.list(),
        chatApi.getAllChats(),
      ]);
      setFiles(filesData.files);
      setChats(chatsData.chats);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: FileMetadata) => {
    setSelectedFile(file);
    setSelectedChat(null); // 새 대화 시작
  };

  const handleChatSelect = async (chatId: string) => {
    setSelectedChat(chatId);
    // 채팅 히스토리를 로드해서 file_id를 가져옴
    try {
      const history = await chatApi.getHistory(chatId);
      const file = files.find(f => f.file_id === history.file_id);
      if (file) {
        setSelectedFile(file);
      } else {
        // 파일이 삭제된 경우에도 대화 내용은 볼 수 있도록 함 (읽기 전용)
        setSelectedFile(null);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      setSelectedChat(null);
    }
  };

  const handleNewChat = () => {
    setSelectedChat(null);
    // 선택된 파일은 유지
  };

  const handleFileUploaded = async () => {
    const filesData = await filesApi.list();
    setFiles(filesData.files);
  };

  const handleFileDeleted = async () => {
    // 파일 삭제 후 목록 새로고침 및 선택 해제
    const filesData = await filesApi.list();
    setFiles(filesData.files);
    setSelectedFile(null);
    setSelectedChat(null);
  };

  const handleChatDeleted = async () => {
    // 대화 삭제 후 목록 새로고침 및 선택 해제
    const chatsData = await chatApi.getAllChats();
    setChats(chatsData.chats);
    setSelectedChat(null);
  };

  const handleChatCreated = async (chatId: string) => {
    setSelectedChat(chatId);
    const chatsData = await chatApi.getAllChats();
    setChats(chatsData.chats);
  };

  if (loading) {
    return (
      <div className="app">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div 
              className="text-2xl font-bold mb-2"
              style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              HyperSignal
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              <span className="animate-pulse">로딩 중...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽: 대화 목록 */}
        <ChatHistoryPanel
          chats={chats}
          files={files}
          selectedChat={selectedChat}
          onChatSelect={handleChatSelect}
          onNewChat={handleNewChat}
          onChatDeleted={handleChatDeleted}
        />

        {/* 가운데: 채팅창 */}
        <ChatPanel
          selectedFile={selectedFile}
          selectedChat={selectedChat}
          onChatCreated={handleChatCreated}
        />

        {/* 오른쪽: 파일 목록 */}
        <FileListPanel
          files={files}
          selectedFile={selectedFile}
          onFileSelect={handleFileSelect}
          onFileUploaded={handleFileUploaded}
          onFileDeleted={handleFileDeleted}
        />
      </div>
    </div>
  );
}

export default App;
