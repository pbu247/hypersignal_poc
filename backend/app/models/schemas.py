from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ColumnType(str, Enum):
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    DATE = "date"
    DATETIME = "datetime"
    BOOLEAN = "boolean"


class ColumnInfo(BaseModel):
    name: str
    type: ColumnType
    nullable: bool = True
    sample_values: Optional[List[Any]] = None


class FileMetadata(BaseModel):
    file_id: str
    filename: str
    original_filename: str
    version: int
    file_size: int
    row_count: int
    columns: List[ColumnInfo]
    parquet_path: str
    date_column: Optional[str] = None
    is_partitioned: bool = False
    recommended_prompts: Optional[List[str]] = None  # AI 추천 프롬프트
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class FileUploadResponse(BaseModel):
    file_id: str
    filename: str
    version: int
    row_count: int
    columns: List[ColumnInfo]
    message: str


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    sql_query: Optional[str] = None
    chart_data: Optional[Dict[str, Any]] = None


class ChatHistory(BaseModel):
    chat_id: str
    file_id: str
    title: str
    messages: List[ChatMessage] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SuggestedQuestions(BaseModel):
    file_id: str
    questions: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ChatRequest(BaseModel):
    chat_id: Optional[str] = None
    file_id: str
    message: str


class ChatResponse(BaseModel):
    chat_id: str
    message: ChatMessage
    suggested_questions: Optional[List[str]] = None


class SuggestedQuestionsRequest(BaseModel):
    file_id: str
    force_new: bool = False


class SuggestedQuestionsResponse(BaseModel):
    questions: List[str]
