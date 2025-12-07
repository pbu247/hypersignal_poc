import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import type { FileMetadata, ChatHistory, ChatSummary } from '../types';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Files API
export const filesApi = {
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(API_ENDPOINTS.uploadFile, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  list: async (): Promise<{ files: FileMetadata[] }> => {
    const response = await api.get(API_ENDPOINTS.listFiles);
    return response.data;
  },

  get: async (fileId: string): Promise<FileMetadata> => {
    const response = await api.get(API_ENDPOINTS.getFile(fileId));
    return response.data;
  },

  getData: async (fileId: string, limit: number = 30): Promise<{ rows: any[], count: number }> => {
    const response = await api.get(API_ENDPOINTS.getFileData(fileId, limit));
    return response.data;
  },
};

// Chat API
export const chatApi = {
  sendMessage: async (data: {
    chat_id?: string;
    file_id: string;
    message: string;
  }) => {
    const response = await api.post(API_ENDPOINTS.sendMessage, data);
    return response.data;
  },

  sendMessageStream: async (
    data: {
      chat_id?: string;
      file_id: string;
      message: string;
    },
    onStatus: (message: string) => void,
    onComplete: (result: any) => void,
    onError: (error: string) => void
  ) => {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.sendMessageStream}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No reader available');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const event = JSON.parse(jsonStr);
              
              if (event.type === 'status') {
                onStatus(event.message);
              } else if (event.type === 'complete') {
                onComplete(event);
              } else if (event.type === 'error') {
                onError(event.message);
              }
            } catch (e) {
              console.error('Failed to parse SSE event:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  getSuggestions: async (fileId: string, forceNew: boolean = false): Promise<{ questions: string[] }> => {
    const response = await api.post(API_ENDPOINTS.getSuggestions, {
      file_id: fileId,
      force_new: forceNew,
    });
    return response.data;
  },

  getHistory: async (chatId: string): Promise<ChatHistory> => {
    const response = await api.get(API_ENDPOINTS.getChatHistory(chatId));
    return response.data;
  },

  getListByFile: async (fileId: string): Promise<{ chats: ChatHistory[] }> => {
    const response = await api.get(API_ENDPOINTS.getChatListByFile(fileId));
    return response.data;
  },

  getAllChats: async (): Promise<{ chats: ChatSummary[] }> => {
    const response = await api.get(API_ENDPOINTS.getAllChats);
    return response.data;
  },
};
