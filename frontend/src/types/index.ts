export interface ColumnInfo {
  name: string;
  type: 'string' | 'integer' | 'float' | 'date' | 'datetime' | 'boolean';
  nullable: boolean;
  sample_values?: any[];
}

export interface FileMetadata {
  file_id: string;
  filename: string;
  original_filename: string;
  version: number;
  file_size: number;
  row_count: number;
  columns: ColumnInfo[];
  parquet_path: string;
  date_column?: string;
  is_partitioned: boolean;
  recommended_prompts?: string[];
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sql_query?: string;
  chart_data?: any;
}

export interface ChatHistory {
  chat_id: string;
  file_id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface ChatSummary {
  chat_id: string;
  file_id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}
