export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  // Files
  uploadFile: '/api/files/upload',
  listFiles: '/api/files/list',
  getFile: (fileId: string) => `/api/files/${fileId}`,
  getFileData: (fileId: string, limit: number = 30) => `/api/files/${fileId}/data?limit=${limit}`,
  
  // Chat
  sendMessage: '/api/chat/message',
  sendMessageStream: '/api/chat/message/stream',
  getSuggestions: '/api/chat/suggestions',
  getChatHistory: (chatId: string) => `/api/chat/history/${chatId}`,
  getChatListByFile: (fileId: string) => `/api/chat/history/file/${fileId}`,
  getAllChats: '/api/chat/list',
};
