import React, { useState, useEffect, useRef } from 'react';
import {
  DocumentChartBarIcon,
  ChevronRightIcon,
  BoltIcon,
  MagnifyingGlassIcon,
  TableCellsIcon,
  ChatBubbleLeftRightIcon,
  PresentationChartLineIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';
import { PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/solid';
import type { FileMetadata, ChatMessage } from '../types';
import { chatApi } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChartView from './ChartView';
import HyperQueryModal from './HyperQueryModal';

interface ChatPanelProps {
  selectedFile: FileMetadata | null;
  selectedChat: string | null;
  onChatCreated: (chatId: string) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  selectedFile,
  selectedChat,
  onChatCreated,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showColumnInfo, setShowColumnInfo] = useState(false);
  const [showHyperQuery, setShowHyperQuery] = useState(false);
  const [activeTab, setActiveTab] = useState<'columns' | 'rows'>('columns');
  const [fileData, setFileData] = useState<any[]>([]);
  const [loadingFileData, setLoadingFileData] = useState(false);
  const [rowLimit, setRowLimit] = useState(30);
  const [processingStatus, setProcessingStatus] = useState('');
  const [processingStep, setProcessingStep] = useState(0); // 0: 대기, 1: 분석, 2: 찾기, 3: 분석, 4: 준비
  const [elapsedTime, setElapsedTime] = useState(0);
  const [columnSuggestions, setColumnSuggestions] = useState<string[]>([]);
  const [showColumnSuggestions, setShowColumnSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isApplyingSuggestion = useRef(false);
  const columnSuggestionsRef = useRef<string[]>([]);
  const selectedIndexRef = useRef(0);

  // columnSuggestions와 selectedSuggestionIndex를 ref에도 동기화
  useEffect(() => {
    columnSuggestionsRef.current = columnSuggestions;
  }, [columnSuggestions]);

  useEffect(() => {
    selectedIndexRef.current = selectedSuggestionIndex;
  }, [selectedSuggestionIndex]);

  useEffect(() => {
    if (selectedChat) {
      loadChatHistory();
    } else {
      setMessages([]);
      setSuggestions([]); // 추천 질문 초기화
      if (selectedFile) {
        loadSuggestions();
      }
    }
  }, [selectedChat, selectedFile]);

  useEffect(() => {
    scrollToBottom();
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [messages, loading, processingStatus]);

  // 행 구성 탭으로 전환 시 항상 데이터 로드
  useEffect(() => {
    if (showColumnInfo && activeTab === 'rows' && selectedFile && !loadingFileData) {
      setLoadingFileData(true);
      const loadData = async () => {
        try {
          const { filesApi } = await import('../services/api');
          const result = await filesApi.getData(selectedFile.file_id, rowLimit);
          setFileData(result.rows);
        } catch (error) {
          console.error('Failed to load file data:', error);
        } finally {
          setLoadingFileData(false);
        }
      };
      loadData();
    }
    
    // 탭이 rows가 아니거나 모달이 닫히면 데이터 초기화
    if (!showColumnInfo || activeTab !== 'rows') {
      setFileData([]);
    }
  }, [showColumnInfo, activeTab, selectedFile, rowLimit]);

  const loadChatHistory = async () => {
    if (!selectedChat) return;
    try {
      const history = await chatApi.getHistory(selectedChat);
      setMessages(history.messages);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const loadSuggestions = async (forceNew: boolean = false) => {
    if (!selectedFile) return;
    try {
      setSuggestions([]); // 로딩 중 표시를 위해 먼저 초기화
      const result = await chatApi.getSuggestions(selectedFile.file_id, forceNew);
      setSuggestions(result.questions);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedFile || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setProcessingStep(1); // 분석 시작
    setSuggestions([]);
    setShowColumnSuggestions(false);
    setElapsedTime(0);

    // 경과 시간 타이머 시작
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setElapsedTime((Date.now() - startTime) / 1000);
    }, 100);
    
    // 단계별 진행 - 랜덤 간격으로 자연스럽게
    const stepTimers: number[] = [];
    
    // 1단계는 이미 시작됨
    // 2단계: 0.5~0.9초 후
    stepTimers.push(setTimeout(() => {
      setProcessingStep(2);
    }, 500 + Math.random() * 400));
    
    // 3단계: 2단계 후 0.6~1.0초 후 (누적 1.1~1.9초)
    stepTimers.push(setTimeout(() => {
      setProcessingStep(3);
    }, 1100 + Math.random() * 800));
    
    // 4단계: 3단계 후 0.4~0.7초 후 (누적 1.5~2.6초)
    stepTimers.push(setTimeout(() => {
      setProcessingStep(4);
    }, 1500 + Math.random() * 1100));

    // 사용자 메시지 추가
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newUserMessage]);

    try {
      await chatApi.sendMessageStream(
        {
          chat_id: selectedChat || undefined,
          file_id: selectedFile.file_id,
          message: userMessage,
        },
        // onStatus
        (message: string) => {
          setProcessingStatus(message);
        },
        // onComplete
        (result: any) => {
          clearInterval(timerInterval);
          setProcessingStatus('');
          setElapsedTime(0);
          setLoading(false);

          // AI 응답 추가
          const aiMessage: ChatMessage = {
            role: result.message.role,
            content: result.message.content,
            timestamp: result.message.timestamp,
            sql_query: result.message.sql_query,
            chart_data: result.message.chart_data,
          };
          setMessages((prev) => [...prev, aiMessage]);

          // 새 채팅이 생성된 경우
          if (!selectedChat && result.chat_id) {
            onChatCreated(result.chat_id);
          }

          // 추천 질문이 있으면 표시
          if (result.suggested_questions) {
            setSuggestions(result.suggested_questions);
          }
        },
        // onError
        (error: string) => {
          stepTimers.forEach(timer => clearTimeout(timer));
          setProcessingStatus('');
          setProcessingStep(0);
          setLoading(false);
          alert(`메시지 전송에 실패했습니다: ${error}`);
        }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      clearInterval(timerInterval);
      stepTimers.forEach(timer => clearTimeout(timer));
      setProcessingStatus('');
      setProcessingStep(0);
      setLoading(false);
      alert('메시지 전송에 실패했습니다.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Tab 키 처리 - 자동완성 적용
    if (e.key === 'Tab') {
      if (showColumnSuggestions && columnSuggestionsRef.current.length > 0) {
        e.preventDefault();
        e.stopPropagation();

        // Enter 키 이벤트 시뮬레이션 (파란 밑줄 제거)
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true,
          cancelable: true
        });
        inputRef.current?.dispatchEvent(enterEvent);

        // 100ms 후에 자동완성 적용
        setTimeout(() => {
          isApplyingSuggestion.current = true;
          applySuggestion(columnSuggestionsRef.current[selectedIndexRef.current]);
          setTimeout(() => {
            isApplyingSuggestion.current = false;
          }, 50);
        }, 100);
        return;
      }
    }

    // Enter 키 처리
    if (e.key === 'Enter' && !e.shiftKey) {
      // 자동완성이 열려있으면 Enter 막기
      if (showColumnSuggestions && columnSuggestionsRef.current.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // 자동완성 적용 중이면 무시
      if (isApplyingSuggestion.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // 자동완성이 닫혀있으면 메시지 전송
      e.preventDefault();
      handleSend();
      return;
    }

    // 자동완성이 열려있을 때만 처리하는 키들
    if (showColumnSuggestions && columnSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedSuggestionIndex((prev) => {
          const newIndex = Math.min(prev + 1, columnSuggestions.length - 1);
          setTimeout(() => {
            suggestionRefs.current[newIndex]?.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
            });
          }, 0);
          return newIndex;
        });
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedSuggestionIndex((prev) => {
          const newIndex = Math.max(prev - 1, 0);
          setTimeout(() => {
            suggestionRefs.current[newIndex]?.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
            });
          }, 0);
          return newIndex;
        });
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowColumnSuggestions(false);
        return;
      }
    }
  };

  const handleSuggestionClick = async (question: string) => {
    if (!selectedFile || loading) return;

    setInput('');
    setSuggestions([]);
    setShowColumnSuggestions(false);
    setLoading(true);
    setProcessingStep(1); // 분석 시작
    setElapsedTime(0);

    // 경과 시간 타이머 시작
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setElapsedTime((Date.now() - startTime) / 1000);
    }, 100);
    
    // 단계별 진행 - 랜덤 간격으로 자연스럽게
    const stepTimers: number[] = [];
    
    // 1단계는 이미 시작됨
    // 2단계: 0.5~0.9초 후
    stepTimers.push(setTimeout(() => {
      setProcessingStep(2);
    }, 500 + Math.random() * 400));
    
    // 3단계: 2단계 후 0.6~1.0초 후 (누적 1.1~1.9초)
    stepTimers.push(setTimeout(() => {
      setProcessingStep(3);
    }, 1100 + Math.random() * 800));
    
    // 4단계: 3단계 후 0.4~0.7초 후 (누적 1.5~2.6초)
    stepTimers.push(setTimeout(() => {
      setProcessingStep(4);
    }, 1500 + Math.random() * 1100));

    // 사용자 메시지 추가
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newUserMessage]);

    try {
      await chatApi.sendMessageStream(
        {
          chat_id: selectedChat || undefined,
          file_id: selectedFile.file_id,
          message: question,
        },
        // onStatus
        (message: string) => {
          setProcessingStatus(message);
        },
        // onComplete
        (result: any) => {
          clearInterval(timerInterval);
          stepTimers.forEach(timer => clearTimeout(timer));
          setProcessingStatus('');
          setProcessingStep(0);
          setElapsedTime(0);
          setLoading(false);

          // AI 응답 추가
          const aiMessage: ChatMessage = {
            role: result.message.role,
            content: result.message.content,
            timestamp: result.message.timestamp,
            sql_query: result.message.sql_query,
            chart_data: result.message.chart_data,
          };
          setMessages((prev) => [...prev, aiMessage]);

          // 새 채팅이 생성된 경우
          if (!selectedChat && result.chat_id) {
            onChatCreated(result.chat_id);
          }

          // 추천 질문이 있으면 표시
          if (result.suggested_questions) {
            setSuggestions(result.suggested_questions);
          }
        },
        // onError
        (error: string) => {
          clearInterval(timerInterval);
          stepTimers.forEach(timer => clearTimeout(timer));
          setProcessingStatus('');
          setProcessingStep(0);
          setElapsedTime(0);
          setLoading(false);
          alert(`메시지 전송에 실패했습니다: ${error}`);
        }
      );
    } catch (error) {
      clearInterval(timerInterval);
      stepTimers.forEach(timer => clearTimeout(timer));
      console.error('Failed to send message:', error);
      setProcessingStatus('');
      setProcessingStep(0);
      setElapsedTime(0);
      setLoading(false);
      alert('메시지 전송에 실패했습니다.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // 자동 높이 조절
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }

    // 자동완성 적용 중이면 자동완성 로직 스킵
    if (isApplyingSuggestion.current) {
      return;
    }

    if (!selectedFile) {
      setShowColumnSuggestions(false);
      return;
    }

    // 현재 커서 위치 가져오기
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);

    // ??? 체크 - 모든 컬럼명 표시
    if (textBeforeCursor.endsWith('???')) {
      const allColumns = selectedFile.columns
        .map(col => col.name)
        .slice(0, 10); // 최대 10개까지 표시

      setColumnSuggestions(allColumns);
      setShowColumnSuggestions(true);
      setSelectedSuggestionIndex(0);
      return;
    }

    // 마지막 단어 추출 (공백, 쉼표, 괄호 등으로 구분)
    const wordMatch = textBeforeCursor.match(/[\wㄱ-ㅎㅏ-ㅣ가-힣_]+$/);

    if (wordMatch && wordMatch[0].length > 0) {
      const currentWord = wordMatch[0].toLowerCase();

      // 컬럼명 필터링
      const matches = selectedFile.columns
        .map(col => col.name)
        .filter(colName => colName.toLowerCase().includes(currentWord))
        .slice(0, 5); // 최대 5개까지만 표시

      if (matches.length > 0) {
        setColumnSuggestions(matches);
        setShowColumnSuggestions(true);
        setSelectedSuggestionIndex(0);
      } else {
        setShowColumnSuggestions(false);
      }
    } else {
      setShowColumnSuggestions(false);
    }
  };

  const applySuggestion = (columnName: string) => {
    if (!inputRef.current) return;

    // 플래그 설정 - handleInputChange가 자동완성 로직을 스킵하도록
    isApplyingSuggestion.current = true;

    // 자동완성 닫기
    setShowColumnSuggestions(false);
    setColumnSuggestions([]);

    const cursorPosition = inputRef.current.selectionStart || 0;
    const fullText = inputRef.current.value;
    const textBeforeCursor = fullText.substring(0, cursorPosition);

    let newText = '';
    let newCursorPos = 0;

    // ??? 패턴 체크 - ??? 를 컬럼명으로 교체
    if (textBeforeCursor.endsWith('???')) {
      const beforePattern = textBeforeCursor.substring(0, textBeforeCursor.length - 3);
      const textAfterCursor = fullText.substring(cursorPosition);
      newText = beforePattern + columnName + textAfterCursor;
      newCursorPos = beforePattern.length + columnName.length;
    } else {
      // 마지막 단어를 찾아서 완전히 교체
      const wordMatch = textBeforeCursor.match(/[\wㄱ-ㅎㅏ-ㅣ가-힣_]+$/);
      if (wordMatch) {
        const wordStartPos = cursorPosition - wordMatch[0].length;
        const wordEndPos = cursorPosition;
        newText = fullText.substring(0, wordStartPos) + columnName + fullText.substring(wordEndPos);
        newCursorPos = wordStartPos + columnName.length;
      } else {
        return;
      }
    }

    // state 업데이트
    setInput(newText);

    // 커서 위치 조정 및 플래그 해제
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current.focus();
      }
      // 플래그 해제
      setTimeout(() => {
        isApplyingSuggestion.current = false;
      }, 50);
    });
  };

  const getColumnTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      string: '문자',
      integer: '정수',
      float: '실수',
      date: '날짜',
      datetime: '날짜시간',
      boolean: '참/거짓',
    };
    return typeMap[type] || type;
  };

  if (!selectedFile) {
    return (
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.08) 0%, var(--background) 70%)',
        }}
      >
        <div className="text-center max-w-2xl">
          {/* Icon */}
          <div
            className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.2)',
            }}
          >
            <DocumentChartBarIcon className="w-12 h-12" style={{ color: 'white' }} />
          </div>

          {/* Title */}
          <h2
            className="text-2xl font-bold mb-4"
            style={{
              background: 'linear-gradient(135deg, var(--text) 0%, var(--primary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            데이터 분석을 시작해보세요
          </h2>

          {/* Description */}
          <p className="text-base mb-8" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            파일을 업로드하고 데이터를 탐색을 AI Agent와 함께하세요
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div
              className="p-5 rounded-xl text-left transition-all duration-200"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.08)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
                <ChatBubbleLeftRightIcon className="w-5 h-5" style={{ color: 'rgb(59, 130, 246)' }} />
              </div>
              <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--text)' }}>
                자연어로 질문
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                "상위 10개 데이터를 보여줘"처럼 일상 언어로 질문하세요
              </p>
            </div>

            <div
              className="p-5 rounded-xl text-left transition-all duration-200"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.15)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}>
                <PresentationChartLineIcon className="w-5 h-5" style={{ color: 'rgb(16, 185, 129)' }} />
              </div>
              <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--text)' }}>
                자동 차트 생성
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                데이터 특성에 맞는 차트를 AI가 자동으로 선택합니다
              </p>
            </div>

            <div
              className="p-5 rounded-xl text-left transition-all duration-200"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.15)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.08)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.05)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)' }}>
                <LightBulbIcon className="w-5 h-5" style={{ color: 'rgb(245, 158, 11)' }} />
              </div>
              <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--text)' }}>
                스마트 추천
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                AI가 데이터를 분석하여 유용한 질문을 추천합니다
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col"
      style={{ backgroundColor: 'var(--background)' }}
    >
      {/* File Info Header */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.15) 100%)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
            }}
          >
            <DocumentChartBarIcon className="w-5 h-5" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <div
              className="font-semibold mb-0.5 text-base"
              style={{
                color: 'var(--text)',
              }}
            >
              {selectedFile.filename}
            </div>
            <div
              className="text-xs flex items-center gap-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }}></span>
                {selectedFile.row_count.toLocaleString()}개 행
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--secondary)' }}></span>
                {selectedFile.columns.length}개 열
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowColumnInfo(!showColumnInfo)}
            className="px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
              color: 'var(--primary)',
              border: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)';
              e.currentTarget.style.color = 'var(--primary)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
            데이터 구성
          </button>
          <button
            onClick={() => setShowHyperQuery(true)}
            className="px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)',
              color: 'rgb(5, 150, 105)',
              border: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgb(16, 185, 129) 0%, rgb(5, 150, 105) 100%)';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)';
              e.currentTarget.style.color = 'rgb(5, 150, 105)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <BoltIcon className="w-4 h-4" />
            HyperQuery
          </button>
        </div>
      </div>

      {/* Column Info Modal */}
      {showColumnInfo && (
        <div
          className="absolute inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setShowColumnInfo(false)}
        >
          <div
            className="rounded-2xl p-6 max-w-5xl w-full mx-8 max-h-[85vh] overflow-hidden flex flex-col"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <h3
              className="text-xl font-bold mb-4"
              style={{ color: 'var(--text)' }}
            >
              데이터 구성
            </h3>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setActiveTab('columns')}
                className="px-4 py-2 text-sm font-medium transition-all duration-200 relative"
                style={{
                  color: activeTab === 'columns' ? 'var(--primary)' : 'var(--text-secondary)',
                }}
              >
                <TableCellsIcon className="w-4 h-4 inline-block mr-1.5" />
                열 구성
                {activeTab === 'columns' && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: 'var(--primary)' }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('rows')}
                className="px-4 py-2 text-sm font-medium transition-all duration-200 relative"
                style={{
                  color: activeTab === 'rows' ? 'var(--primary)' : 'var(--text-secondary)',
                }}
              >
                <DocumentChartBarIcon className="w-4 h-4 inline-block mr-1.5" />
                행 구성
                {activeTab === 'rows' && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: 'var(--primary)' }}
                  />
                )}
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'columns' ? (
                <div className="grid grid-cols-2 gap-3">
                  {selectedFile.columns.map((col, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-lg transition-all duration-200 hover:shadow-md"
                      style={{
                        backgroundColor: 'var(--background)',
                        border: '1.5px solid var(--border)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="font-semibold text-sm"
                          style={{ color: 'var(--text)' }}
                        >
                          {col.name}
                        </span>
                        <span
                          className="text-xs px-2.5 py-1 rounded-md font-medium"
                          style={{
                            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                            color: 'white',
                          }}
                        >
                          {getColumnTypeLabel(col.type)}
                        </span>
                      </div>
                      {col.sample_values && col.sample_values.length > 0 && (
                        <div
                          className="text-xs mt-2 p-2 rounded-md"
                          style={{
                            color: 'var(--text-secondary)',
                            backgroundColor: 'var(--surface)',
                          }}
                        >
                          <div className="font-medium mb-1 text-[10px]" style={{ color: 'var(--accent)' }}>예시:</div>
                          {col.sample_values.slice(0, 3).map((val, i) => (
                            <div key={i} className="py-0.5 text-[11px]">• {val}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  {/* Header - Fixed */}
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {selectedFile && selectedFile.row_count <= 30 
                        ? `전체 ${selectedFile.row_count}개 행을 표시합니다`
                        : `상위 ${rowLimit}개 행을 표시합니다`
                      }
                    </p>
                    {selectedFile && selectedFile.row_count > 30 && (
                      <div className="flex items-center gap-2">
                        {[30, 50, 100, 150, 200].map((limit) => (
                          <button
                            key={limit}
                            onClick={async () => {
                              setRowLimit(limit);
                              if (selectedFile) {
                                setLoadingFileData(true);
                                try {
                                  const { filesApi } = await import('../services/api');
                                  const result = await filesApi.getData(selectedFile.file_id, Math.min(limit, 300));
                                  setFileData(result.rows);
                                } catch (error) {
                                  console.error('Failed to load file data:', error);
                                } finally {
                                  setLoadingFileData(false);
                                }
                              }
                            }}
                            disabled={loadingFileData}
                            className="px-3 py-1 text-xs rounded-md transition-all duration-200"
                            style={{
                              backgroundColor: rowLimit === limit ? 'var(--primary)' : 'var(--background)',
                            color: rowLimit === limit ? 'white' : 'var(--text-secondary)',
                            border: `1px solid ${rowLimit === limit ? 'var(--primary)' : 'var(--border)'}`,
                            cursor: loadingFileData ? 'not-allowed' : 'pointer',
                            opacity: loadingFileData ? 0.6 : 1,
                          }}
                        >
                          {limit}개
                        </button>
                      ))}
                      </div>
                    )}
                  </div>

                  {/* Table Container - Scrollable */}
                  <div
                    className="flex-1"
                    style={{
                      overflowX: 'scroll',
                      overflowY: 'auto',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      minHeight: '400px'
                    }}
                  >
                    {loadingFileData ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--primary)', animationDelay: '0s' }} />
                          <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--primary)', animationDelay: '0.1s' }} />
                          <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--primary)', animationDelay: '0.2s' }} />
                          <span className="text-sm ml-2" style={{ color: 'var(--text-secondary)' }}>데이터 불러오는 중...</span>
                        </div>
                        <div className="w-64 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)',
                              animation: 'progress 1.5s ease-in-out infinite',
                            }}
                          />
                        </div>
                        <style>{`
                          @keyframes progress {
                            0% { width: 0%; margin-left: 0%; }
                            50% { width: 75%; margin-left: 0%; }
                            100% { width: 0%; margin-left: 100%; }
                          }
                        `}</style>
                      </div>
                    ) : fileData.length > 0 ? (
                      <table className="w-full text-xs border-collapse" style={{ border: '1px solid var(--border)' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--background)' }}>
                            {selectedFile.columns.map((col, idx) => (
                              <th
                                key={idx}
                                className="px-2 py-1.5 text-left font-semibold border"
                                style={{
                                  borderColor: 'var(--border)',
                                  color: 'var(--text)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {col.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {fileData.map((row, rowIdx) => (
                            <tr key={rowIdx} style={{ backgroundColor: rowIdx % 2 === 0 ? 'var(--surface)' : 'var(--background)' }}>
                              {selectedFile.columns.map((col, colIdx) => (
                                <td
                                  key={colIdx}
                                  className="px-2 py-1 border"
                                  style={{
                                    borderColor: 'var(--border)',
                                    color: 'var(--text-secondary)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex items-center justify-center py-12">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>버튼을 클릭하여 데이터를 확인하세요</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-8 space-y-1">
        {messages.length === 0 && (
          <div className="animate-fade-in max-w-4xl mx-auto">
            <div
              className="text-center mb-8"
            >
              <SparklesIcon className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: 'var(--primary)' }} />
              <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
                추천 질문으로 시작해보세요
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                아래 질문을 클릭하거나 직접 질문을 입력하세요
              </p>
            </div>

            {/* 기본 추천 질문 */}
            <div className="mb-6">
              <div className="text-xs font-medium mb-3 px-2" style={{ color: 'var(--text-secondary)' }}>
                기본 질문
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  '상위 10개 데이터를 보여주세요',
                  '전체 데이터를 요약해주세요',
                  '데이터의 기본 통계를 보여주세요',
                  '컬럼별 데이터 타입을 알려주세요',
                ].map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(question)}
                    className="p-4 rounded-xl text-left transition-all duration-200 group"
                    style={{
                      backgroundColor: 'rgba(99, 102, 241, 0.03)',
                      border: 'none',
                      color: 'var(--text)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(99, 102, 241, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.03)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <DocumentChartBarIcon
                        className="w-5 h-5 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--accent)' }}
                      />
                      <span className="text-sm leading-relaxed">{question}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* AI 생성 추천 질문 */}
            {suggestions.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-3 px-2">
                  <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    AI 추천 질문
                  </div>
                  <button
                    onClick={() => loadSuggestions(true)}
                    disabled={loading}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
                    style={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--primary)',
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                        e.currentTarget.style.borderColor = 'var(--primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--surface)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  >
                    다른 질문 보기
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {suggestions.map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(question)}
                      className="p-4 rounded-xl text-left transition-all duration-200 group"
                      style={{
                        backgroundColor: 'rgba(139, 92, 246, 0.03)',
                        border: 'none',
                        color: 'var(--text)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 16px rgba(139, 92, 246, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.03)';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <SparklesIcon
                          className="w-5 h-5 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--primary)' }}
                        />
                        <span className="text-sm leading-relaxed">{question}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>추천 질문을 생각하고 있습니다...</span>
              </div>
            )}
          </div>
        )}

        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in mb-6`}
          >
            <div
              className="max-w-2xl rounded-2xl px-5 py-4 shadow-md chat-message"
              style={{
                backgroundColor: message.role === 'user' ? 'var(--primary)' : 'var(--surface)',
                color: message.role === 'user' ? 'white' : 'var(--text)',
              }}
            >
              <div className="prose prose-sm max-w-none leading-relaxed mb-3 text-sm" style={{
                color: message.role === 'user' ? 'white' : 'var(--text)',
              }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ node, children, ...props }) => {
                      // AI 메시지이고 children이 문자열인 경우 질문 패턴 체크
                      if (message.role === 'assistant' && typeof children === 'string') {
                        const text = children;
                        // 실제 질문만 감지 (물음표로 끝나거나, ~나요/인가요/까요/주세요/해주세요 등으로 끝남)
                        const isRealQuestion = text.trim().endsWith('?') || 
                                             text.trim().match(/(?:나요|인가요|까요|주세요|해주세요|분석해주세요|알려주세요|보여주세요|설명해주세요)\?*$/);
                        const isGuidanceText = text.includes('추천드립니다') || 
                                              text.includes('해주시겠어요') ||
                                              text.includes('질문을') ||
                                              text.includes('다음과 같은');
                        
                        if (isRealQuestion && !isGuidanceText) {
                          return (
                            <button
                              onClick={() => handleSuggestionClick(text.trim())}
                              className="w-full text-left mb-2 p-3 rounded-lg transition-all duration-200 hover:translate-x-1"
                              style={{
                                backgroundColor: 'rgba(139, 92, 246, 0.05)',
                                border: 'none',
                                color: 'var(--text)',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.12)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.2)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.05)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              <span className="flex items-center gap-2">
                                <SparklesIcon className="w-4 h-4 shrink-0" style={{ color: 'var(--primary)' }} />
                                <span>{text}</span>
                              </span>
                            </button>
                          );
                        }
                      }
                      return <p className="mb-3 last:mb-0" {...props}>{children}</p>;
                    },
                    ul: ({ node, ...props }) => <ul className="mb-3 ml-4 space-y-1" {...props} />,
                    ol: ({ node, ...props }) => <ol className="mb-3 ml-4 space-y-1" {...props} />,
                    li: ({ node, children, ...props }) => {
                      // li 안의 텍스트도 실제 질문만 체크
                      if (message.role === 'assistant' && typeof children === 'string') {
                        const text = children;
                        const isRealQuestion = text.trim().endsWith('?') || 
                                             text.trim().match(/(?:나요|인가요|까요|주세요|해주세요|분석해주세요|알려주세요|보여주세요|설명해주세요)\?*$/);
                        const isGuidanceText = text.includes('추천드립니다') || 
                                              text.includes('해주시겠어요') ||
                                              text.includes('질문을') ||
                                              text.includes('다음과 같은');
                        
                        if (isRealQuestion && !isGuidanceText) {
                          return (
                            <li className="mb-1" {...props}>
                              <button
                                onClick={() => handleSuggestionClick(text.trim())}
                                className="w-full text-left p-2.5 rounded-lg transition-all duration-200 hover:translate-x-1"
                                style={{
                                  backgroundColor: 'rgba(139, 92, 246, 0.05)',
                                  border: 'none',
                                  color: 'var(--text)',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.12)';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.2)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.05)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              >
                                <span className="flex items-center gap-2">
                                  <SparklesIcon className="w-4 h-4 shrink-0" style={{ color: 'var(--primary)' }} />
                                  <span>{text}</span>
                                </span>
                              </button>
                            </li>
                          );
                        }
                      }
                      return <li className="mb-1" {...props}>{children}</li>;
                    },
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-4">
                        <table
                          className="min-w-full border-collapse"
                          style={{
                            border: '1px solid var(--border)',
                            whiteSpace: 'nowrap'
                          }}
                          {...props}
                        />
                      </div>
                    ),
                    thead: ({ node, ...props }) => (
                      <thead style={{ backgroundColor: 'var(--accent)', color: 'white' }} {...props} />
                    ),
                    tbody: ({ node, ...props }) => <tbody {...props} />,
                    tr: ({ node, ...props }) => (
                      <tr style={{ borderBottom: '1px solid var(--border)' }} {...props} />
                    ),
                    th: ({ node, ...props }) => (
                      <th
                        className="px-3 py-1.5 text-left font-semibold text-xs"
                        style={{
                          border: '1px solid var(--border)',
                          whiteSpace: 'nowrap'
                        }}
                        {...props}
                      />
                    ),
                    td: ({ node, ...props }) => (
                      <td
                        className="px-3 py-1.5 text-xs"
                        style={{
                          border: '1px solid var(--border)',
                          whiteSpace: 'nowrap'
                        }}
                        {...props}
                      />
                    ),
                    code: ({ node, ...props }) => (
                      <code
                        className="px-2 py-0.5 rounded text-sm font-mono"
                        style={{
                          backgroundColor: message.role === 'user' ? 'rgba(255,255,255,0.2)' : 'var(--background)',
                          color: message.role === 'user' ? 'white' : 'var(--accent)',
                        }}
                        {...props}
                      />
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>

              {message.chart_data && (
                <div className="mt-4 mb-4 p-4 rounded-xl" style={{ backgroundColor: 'white' }}>
                  <ChartView data={message.chart_data} type={message.chart_data.chart_type} />
                </div>
              )}

              {message.sql_query && (
                <details className="mt-4 group">
                  <summary
                    className="cursor-pointer text-xs font-medium px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 w-fit"
                    style={{ 
                      backgroundColor: message.role === 'user' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)',
                      color: message.role === 'user' ? 'rgba(255,255,255,0.85)' : '#6b7280',
                      border: `1px solid ${message.role === 'user' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = message.role === 'user' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)';
                      e.currentTarget.style.borderColor = message.role === 'user' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = message.role === 'user' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)';
                      e.currentTarget.style.borderColor = message.role === 'user' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';
                    }}
                  >
                    <ChevronRightIcon className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                    <span className="font-mono">SQL</span>
                  </summary>
                  <pre
                    className="mt-3 p-4 rounded-lg text-xs overflow-x-auto font-mono leading-relaxed"
                    style={{
                      backgroundColor: message.role === 'user' ? 'rgba(0,0,0,0.15)' : '#f8f9fa',
                      color: message.role === 'user' ? 'rgba(255,255,255,0.95)' : '#374151',
                      border: `1px solid ${message.role === 'user' ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
                      boxShadow: message.role === 'user' ? 'none' : 'inset 0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    {message.sql_query}
                  </pre>
                </details>
              )}

              {message.timestamp && (
                <div
                  className="text-xs mt-3 font-medium"
                  style={{
                    color: message.role === 'user' ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)',
                  }}
                >
                  {(() => {
                    const date = new Date(message.timestamp);
                    // UTC 시간을 KST로 변환 (UTC+9)
                    const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
                    return kstDate.toLocaleString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    }) + ' KST';
                  })()}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 로딩 중일 때 진행 상태 표시 */}
        {loading && (
          <div className="flex justify-start animate-fade-in mb-6">
            <div
              className="rounded-2xl px-5 py-4 shadow-md"
              style={{
                backgroundColor: 'var(--surface)',
                color: 'var(--text)',
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{
                      backgroundColor: 'var(--primary)',
                      animationDelay: '0s'
                    }}
                  />
                  <div
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{
                      backgroundColor: 'var(--primary)',
                      animationDelay: '0.1s'
                    }}
                  />
                  <div
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{
                      backgroundColor: 'var(--primary)',
                      animationDelay: '0.2s'
                    }}
                  />
                </div>
                <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {elapsedTime.toFixed(1)}초
                </span>
              </div>
              
              <div className="space-y-1.5">
                {[
                  { step: 1, text: '질문을 이해하고 있어요' },
                  { step: 2, text: '데이터를 찾고 있어요' },
                  { step: 3, text: '결과를 분석하고 있어요' },
                  { step: 4, text: '답변을 준비하고 있어요' }
                ].map(({ step, text }) => (
                  <div 
                    key={step}
                    className="text-sm transition-all duration-500 ease-in-out"
                    style={{ 
                      color: processingStep === step ? 'var(--primary)' : 
                             processingStep > step ? 'var(--text-secondary)' : 'var(--text-secondary)',
                      opacity: processingStep >= step ? 1 : 0.3,
                      fontWeight: processingStep === step ? 600 : 400,
                      fontSize: processingStep === step ? '0.875rem' : '0.8125rem'
                    }}
                  >
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        className="p-6"
        style={{
          backgroundColor: 'var(--background)',
        }}
      >
        <div className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="데이터에 대해 질문해보세요... (Tab: 자동완성, Enter: 전송, Shift+Enter: 줄바꾸기)"
              disabled={loading}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className="w-full px-5 py-3.5 rounded-xl resize-none focus:ring-2 transition-all duration-200 custom-scrollbar"
              style={{
                backgroundColor: 'var(--background)',
                color: 'var(--text)',
                border: '2px solid var(--border)',
                outline: 'none',
                minHeight: '56px',
                maxHeight: '200px',
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onBlur={(e) => {
                // 약간의 지연을 주어 suggestion 클릭이 가능하도록
                const target = e.currentTarget;
                setTimeout(() => {
                  if (target) {
                    target.style.borderColor = 'var(--border)';
                  }
                }, 200);
              }}
              rows={1}
            />

            {/* Column Autocomplete Dropdown */}
            {showColumnSuggestions && columnSuggestions.length > 0 && (
              <div
                className="absolute bottom-full mb-2 w-full rounded-lg shadow-2xl overflow-hidden z-50"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}
              >
                <div
                  className="px-3 py-2 text-xs font-medium border-b flex items-center justify-between"
                  style={{
                    backgroundColor: 'var(--background)',
                    color: 'var(--text-secondary)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <span>{input.includes('???') ? '전체 컬럼 목록' : '컬럼명 자동완성'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface)', color: 'var(--primary)' }}>
                    {input.includes('???') ? 'Tab: 선택' : 'Tab: 자동완성'}
                  </span>
                </div>
                {columnSuggestions.map((colName, index) => {
                  const column = selectedFile?.columns.find(c => c.name === colName);
                  return (
                    <div
                      key={colName}
                      ref={(el) => { suggestionRefs.current[index] = el; }}
                      onMouseDown={(e) => {
                        e.preventDefault(); // blur 이벤트 방지
                        applySuggestion(colName);
                      }}
                      onMouseEnter={() => setSelectedSuggestionIndex(index)}
                      className="px-4 py-2.5 cursor-pointer transition-colors"
                      style={{
                        backgroundColor: index === selectedSuggestionIndex
                          ? 'var(--primary)'
                          : 'transparent',
                        color: index === selectedSuggestionIndex
                          ? 'white'
                          : 'var(--text)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{colName}</span>
                        {column && (
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: index === selectedSuggestionIndex
                                ? 'rgba(255,255,255,0.2)'
                                : 'var(--background)',
                              color: index === selectedSuggestionIndex
                                ? 'white'
                                : 'var(--text-secondary)',
                            }}
                          >
                            {getColumnTypeLabel(column.type)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 보내기 버튼 - 우측에 고정 */}
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className={`rounded-full font-medium transition-all duration-200 flex items-center justify-center shadow-md hover:shadow-lg shrink-0 ${loading ? 'signal-pulse' : ''}`}
            style={{
              background: loading || !input.trim()
                ? 'var(--border)'
                : 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
              color: 'white',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              height: '48px',
              width: '48px',
              position: 'relative',
              zIndex: 10,
            }}
            onMouseEnter={(e) => {
              if (!loading && input.trim()) {
                e.currentTarget.style.background = 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && input.trim()) {
                e.currentTarget.style.background = 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            <PaperAirplaneIcon className="w-4 h-4" style={{ position: 'relative', zIndex: 1 }} />
          </button>
        </div>
      </div>

      {/* HyperQuery Modal */}
      {selectedFile && (
        <HyperQueryModal
          isOpen={showHyperQuery}
          onClose={() => setShowHyperQuery(false)}
          fileId={selectedFile.file_id}
          fileName={selectedFile.filename}
          rowCount={selectedFile.row_count}
          columns={selectedFile.columns.map(col => ({
            name: col.name,
            type: col.type,
            sample_values: col.sample_values || []
          }))}
        />
      )}
    </div>
  );
};

export default ChatPanel;
