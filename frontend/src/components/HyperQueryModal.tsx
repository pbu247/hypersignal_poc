
import React, { useState, useEffect, useRef } from 'react';
import './hyperquery-animate.css';
import { 
  XMarkIcon, 
  PlayIcon, 
  SparklesIcon, 
  TableCellsIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CodeBracketIcon
} from '@heroicons/react/24/outline';
import { API_BASE_URL } from '../config/api';

interface HyperQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
  rowCount: number;
  columns: Array<{
    name: string;
    type: string;
    sample_values: any[];
  }>;
}

interface QueryResult {
  columns: string[];
  rows: any[][];
  totalRows: number;
}

const HyperQueryModal: React.FC<HyperQueryModalProps> = ({ 
  isOpen, 
  onClose, 
  fileId, 
  fileName,
  rowCount,
  columns 
}) => {
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM data LIMIT 100');
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [displayedRows, setDisplayedRows] = useState<any[][]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [showColumnInfo, setShowColumnInfo] = useState(true);
  const [showAiHelper, setShowAiHelper] = useState(true);
  const [queryExecutionTime, setQueryExecutionTime] = useState<number | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [recommendQueries, setRecommendQueries] = useState<string[]>([]);
  const [randomQueries, setRandomQueries] = useState<string[]>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 추천 쿼리 불러오기 (파일 변경 시)
  useEffect(() => {
    if (!isOpen || !fileId) return;
    fetch(`${API_BASE_URL}/api/query/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId })
    })
      .then(res => res.json())
      .then(data => {
        if (data.queries) {
          setRecommendQueries(data.queries);
          // 2개 랜덤 선택
          const shuffled = [...data.queries].sort(() => 0.5 - Math.random());
          setRandomQueries(shuffled.slice(0, 2));
        }
      })
      .catch(() => setRecommendQueries([]));
  }, [isOpen, fileId]);

  useEffect(() => {
    if (!isOpen) {
      setSqlQuery('SELECT * FROM data LIMIT 100');
      setQueryResult(null);
      setError(null);
      setDisplayedRows([]);
      setShowColumnInfo(true);
      setShowAiHelper(true);
    }
  }, [isOpen]);

  // F5 키로 쿼리 실행
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' && isOpen) {
        e.preventDefault();
        executeQuery();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, sqlQuery, fileId]);

  const handleClose = () => {
    if (sqlQuery.trim() !== 'SELECT * FROM data LIMIT 100' || queryResult) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const executeQuery = async () => {
    setIsExecuting(true);
    setError(null);
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/query/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: fileId,
          query: sqlQuery,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '쿼리 실행 중 오류가 발생했습니다');
      }

      const result = await response.json();
      setQueryResult(result);
      
      const initialRows = result.rows.slice(0, 500);
      setDisplayedRows(initialRows);
      setHasMore(result.rows.length > 500);
      
      const executionTime = (Date.now() - startTime) / 1000;
      setQueryExecutionTime(executionTime);
    } catch (err: any) {
      setError(err.message);
      setQueryResult(null);
      setDisplayedRows([]);
      setQueryExecutionTime(null);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleScroll = () => {
    if (!tableContainerRef.current || !queryResult || loadingMoreRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
    
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasMore) {
      loadingMoreRef.current = true;
      
      setTimeout(() => {
        const currentLength = displayedRows.length;
        const nextBatch = queryResult.rows.slice(currentLength, currentLength + 500);
        
        if (nextBatch.length > 0) {
          setDisplayedRows(prev => [...prev, ...nextBatch]);
          setHasMore(currentLength + nextBatch.length < queryResult.rows.length);
        } else {
          setHasMore(false);
        }
        
        loadingMoreRef.current = false;
      }, 100);
    }
  };

  useEffect(() => {
    const container = tableContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [queryResult, displayedRows, hasMore]);

  const getAiHelp = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsAiLoading(true);
    setAiGenerating(true);
    setGenerationComplete(false);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/query/ai-assist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: fileId,
          prompt: aiPrompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'AI 도움 요청 중 오류가 발생했습니다');
      }

      const result = await response.json();
      setSqlQuery(result.query);
      setAiPrompt('');
      
      // 생성 중 애니메이션 종료 후 완료 애니메이션 시작
      setAiGenerating(false);
      setGenerationComplete(true);
      
      // 완료 애니메이션 후 상태 초기화
      setTimeout(() => {
        setGenerationComplete(false);
      }, 1000);
    } catch (err: any) {
      setError(err.message);
      setAiGenerating(false);
      setGenerationComplete(false);
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
      >
        <div
          className="relative w-full h-full flex flex-col"
          style={{
            backgroundColor: 'var(--background)',
            maxWidth: '98vw',
            maxHeight: '96vh',
            margin: '2vh auto',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* 헤더 */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{
              borderColor: 'var(--border)',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgb(16, 185, 129) 0%, rgb(5, 150, 105) 100%)',
                }}
              >
                <TableCellsIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                  HyperQuery
                </h2>
                <div className="flex items-center gap-2">
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {fileName}
                  </p>
                  <span 
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ 
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: 'rgb(5, 150, 105)'
                    }}
                  >
                    {rowCount.toLocaleString()}건
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: 'var(--background-secondary)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.color = 'rgb(239, 68, 68)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--background-secondary)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* 콘텐츠 영역 */}
          <div className="flex-1 flex overflow-hidden gap-4 p-4">
            {/* 왼쪽: 컬럼 정보 */}
            <div 
              className="flex flex-col border rounded-lg overflow-hidden transition-all duration-300"
              style={{ 
                borderColor: 'var(--border)',
                width: showColumnInfo ? '280px' : '40px',
                backgroundColor: 'var(--background-secondary)'
              }}
            >
              {showColumnInfo ? (
                <>
                  <div 
                    className="flex items-center justify-between p-3 border-b cursor-pointer hover:bg-opacity-80"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
                    onClick={() => setShowColumnInfo(false)}
                  >
                    <div className="flex items-center gap-2">
                      <InformationCircleIcon className="w-4 h-4" style={{ color: 'rgb(16, 185, 129)' }} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>컬럼 정보</span>
                    </div>
                    <ChevronDownIcon className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <div className="flex-1 overflow-auto p-3">
                    <div className="space-y-2">
                      {columns.map((col, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg cursor-pointer transition-all"
                          style={{ backgroundColor: 'var(--background)' }}
                          onClick={() => {
                            const colName = `"${col.name}"`;
                            const textarea = textareaRef.current;
                            if (textarea) {
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;
                              const newValue = sqlQuery.slice(0, start) + colName + sqlQuery.slice(end);
                              setSqlQuery(newValue);
                              
                              // 커서 위치를 삽입된 텍스트 뒤로 이동
                              setTimeout(() => {
                                textarea.focus();
                                textarea.setSelectionRange(start + colName.length, start + colName.length);
                              }, 0);
                            }
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                            e.currentTarget.style.transform = 'translateX(2px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--background)';
                            e.currentTarget.style.transform = 'translateX(0)';
                          }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-xs font-semibold break-all" style={{ color: 'var(--text)' }}>
                              {col.name}
                            </span>
                            <span 
                              className="text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium"
                              style={{ 
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                color: 'rgb(5, 150, 105)'
                              }}
                            >
                              {col.type}
                            </span>
                          </div>
                          {col.sample_values && col.sample_values.length > 0 && (
                            <div className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>
                              샘플: {col.sample_values.slice(0, 2).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setShowColumnInfo(true)}
                  className="h-full flex items-center justify-center p-2 hover:bg-opacity-80 transition-colors"
                  style={{ backgroundColor: 'var(--background)' }}
                  title="컬럼 정보 열기"
                >
                  <InformationCircleIcon className="w-5 h-5" style={{ color: 'rgb(16, 185, 129)' }} />
                </button>
              )}
            </div>

            {/* 중앙: SQL 에디터 & 결과 */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              {/* SQL 에디터 */}
              <div 
                className={`border rounded-lg overflow-hidden ${aiGenerating ? 'sql-editor-loading' : ''} ${generationComplete ? 'sql-editor-complete' : ''}`}
                style={{ 
                  borderColor: aiGenerating || generationComplete ? 'transparent' : 'var(--border)',
                  transition: 'border-color 0.3s ease'
                }}
              >
                <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
                  <div className="flex items-center gap-2">
                    <CodeBracketIcon className="w-4 h-4" style={{ color: 'rgb(16, 185, 129)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>SQL 쿼리</span>
                    {aiGenerating && (
                      <span className="text-xs px-2 py-0.5 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: 'rgb(16, 185, 129)' }}>
                        AI 생성 중...
                      </span>
                    )}
                  </div>
                  <button
                    onClick={executeQuery}
                    disabled={isExecuting}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                    style={{
                      background: isExecuting
                        ? 'rgba(16, 185, 129, 0.5)'
                        : 'linear-gradient(135deg, rgb(16, 185, 129) 0%, rgb(5, 150, 105) 100%)',
                      color: 'white',
                      cursor: isExecuting ? 'not-allowed' : 'pointer',
                      boxShadow: isExecuting ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <PlayIcon className="w-4 h-4" />
                    {isExecuting ? '실행 중...' : '실행 (F5)'}
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  className="w-full p-4 font-mono text-sm resize-none focus:outline-none"
                  style={{
                    backgroundColor: 'var(--background)',
                    color: 'var(--text)',
                    height: '150px',
                  }}
                  placeholder="SELECT * FROM data WHERE ..."
                />
              </div>

              {/* 에러 표시 */}
              {error && (
                <div
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: 'rgb(239, 68, 68)' }}>
                    {error}
                  </p>
                </div>
              )}

              {/* 결과 테이블 */}
              {queryResult && (
                <div className="flex-1 flex flex-col border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        조회 결과
                      </span>
                      <span 
                        className="text-xs px-2.5 py-1 rounded-full font-semibold"
                        style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: 'rgb(5, 150, 105)'
                        }}
                      >
                        {queryResult.totalRows.toLocaleString()}건
                      </span>
                      {displayedRows.length < queryResult.totalRows && (
                        <span 
                          className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{
                            backgroundColor: 'var(--background)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border)'
                          }}
                        >
                          표시: {displayedRows.length.toLocaleString()}건
                        </span>
                      )}
                    </div>
                    {queryExecutionTime !== null && (
                      <span 
                        className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          color: 'rgb(5, 150, 105)'
                        }}
                      >
                        실행 시간: {queryExecutionTime.toFixed(2)}초
                      </span>
                    )}
                  </div>
                  <div 
                    ref={tableContainerRef}
                    className="flex-1 overflow-auto"
                    style={{ backgroundColor: 'var(--background)' }}
                  >
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--background)' }}>
                        <tr style={{ backgroundColor: 'var(--background)' }}>
                          {queryResult.columns.map((col, idx) => (
                            <th
                              key={idx}
                              className="px-4 py-3 text-left font-semibold border-b whitespace-nowrap"
                              style={{ 
                                color: 'var(--text)', 
                                borderColor: 'var(--border)',
                                backgroundColor: 'var(--background)',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                              }}
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayedRows.map((row, rowIdx) => (
                          <tr
                            key={rowIdx}
                            className="border-b hover:bg-opacity-50 transition-colors"
                            style={{ 
                              borderColor: 'var(--border)',
                              backgroundColor: rowIdx % 2 === 0 ? 'transparent' : 'var(--background-secondary)'
                            }}
                          >
                            {row.map((cell, cellIdx) => (
                              <td
                                key={cellIdx}
                                className="px-4 py-2.5 whitespace-nowrap"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {cell !== null && cell !== undefined ? String(cell) : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {hasMore && (
                          <tr>
                            <td colSpan={queryResult.columns.length} className="px-4 py-3 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                              스크롤하여 더 보기...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!queryResult && !error && (
                <div className="flex-1 flex flex-col items-center justify-center rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  <TableCellsIcon className="w-16 h-16 mb-3 opacity-20" />
                  <p className="text-sm">쿼리를 실행하면 결과가 여기에 표시됩니다</p>
                </div>
              )}
            </div>

            {/* 오른쪽: AI 도우미 */}
            <div 
              className="flex flex-col border rounded-lg overflow-hidden transition-all duration-300" 
              style={{ 
                borderColor: 'var(--border)',
                backgroundColor: 'var(--background-secondary)',
                width: showAiHelper ? '320px' : '40px'
              }}
            >
              {showAiHelper ? (
                <>
                  <div 
                    className="flex items-center justify-between p-3 border-b cursor-pointer hover:bg-opacity-80" 
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
                    onClick={() => setShowAiHelper(false)}
                  >
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="w-4 h-4" style={{ color: 'rgb(16, 185, 129)' }} />
                      <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                        AI 쿼리 도우미
                      </h3>
                    </div>
                    <ChevronRightIcon className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </div>

                  <div className="flex-1 flex flex-col p-4 gap-3">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full p-3 rounded-lg text-sm resize-none focus:outline-none"
                  style={{
                    backgroundColor: 'var(--background)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    height: '120px',
                  }}
                  placeholder="예: 2023년 온도가 30도 이상인 데이터를 조회해줘"
                />

                <button
                  onClick={getAiHelp}
                  disabled={isAiLoading || !aiPrompt.trim()}
                  className="w-full px-4 py-2.5 rounded-lg font-semibold text-sm transition-all"
                  style={{
                    background: isAiLoading || !aiPrompt.trim()
                      ? 'rgba(16, 185, 129, 0.3)'
                      : 'linear-gradient(135deg, rgb(16, 185, 129) 0%, rgb(5, 150, 105) 100%)',
                    color: 'white',
                    cursor: isAiLoading || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                    boxShadow: isAiLoading || !aiPrompt.trim() ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  {isAiLoading ? 'AI가 쿼리 생성 중...' : 'AI로 쿼리 생성'}
                </button>

                <div className="flex-1 overflow-auto">
                  <div className="space-y-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background)' }}>
                      <p className="font-semibold mb-2" style={{ color: 'var(--text)' }}>
                        <InformationCircleIcon className="w-3.5 h-3.5 inline mr-1" />
                        기본 사용법
                      </p>
                      <ul className="space-y-1 ml-1">
                        <li>• 테이블명은 항상 "data"</li>
                        <li>• 컬럼명은 큰따옴표로 감싸기</li>
                        <li>• 왼쪽 패널에서 컬럼 클릭으로 삽입</li>
                      </ul>
                    </div>

                    <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background)' }}>
                      <p className="font-semibold mb-2 flex items-center gap-1" style={{ color: 'var(--text)' }}>
                        <CodeBracketIcon className="w-3.5 h-3.5 inline" />
                        추천 쿼리
                      </p>
                      {randomQueries.length > 0 ? (
                        <div className="space-y-2">
                          {randomQueries.map((q, i) => (
                            <code
                              key={i}
                              className="block font-mono text-[10px] p-2 rounded cursor-pointer hover:bg-emerald-50 transition"
                              style={{ backgroundColor: 'rgba(0,0,0,0.15)', color: 'rgb(16, 185, 129)' }}
                              onClick={() => setSqlQuery(q)}
                              title="클릭 시 쿼리 입력창에 복사"
                            >
                              {q}
                            </code>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">추천 쿼리를 불러오는 중...</span>
                      )}
                    </div>

                    <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background)' }}>
                      <p className="font-semibold mb-2" style={{ color: 'var(--text)' }}>
                        <SparklesIcon className="w-3.5 h-3.5 inline mr-1" />
                        AI 도우미 활용
                      </p>
                      <ul className="space-y-1 ml-1">
                        <li>• 자연어로 원하는 쿼리 설명</li>
                        <li>• AI가 자동으로 SQL 생성</li>
                        <li>• 복잡한 조인도 쉽게 작성</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
                </>
              ) : (
                <button
                  onClick={() => setShowAiHelper(true)}
                  className="h-full flex items-center justify-center p-2 hover:bg-opacity-80 transition-colors"
                  style={{ backgroundColor: 'var(--background)' }}
                  title="AI 도우미 열기"
                >
                  <SparklesIcon className="w-5 h-5" style={{ color: 'rgb(16, 185, 129)' }} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 확인 모달 */}
      {showConfirmClose && (
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
              창을 닫으시겠습니까?
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              작성 중인 쿼리와 결과가 사라집니다.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmClose(false)}
                className="px-5 py-2.5 rounded-lg font-medium text-sm transition-all"
                style={{
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--border)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--background-secondary)';
                }}
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowConfirmClose(false);
                  onClose();
                }}
                className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all"
                style={{
                  background: 'linear-gradient(135deg, rgb(239, 68, 68) 0%, rgb(220, 38, 38) 100%)',
                  color: 'white',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HyperQueryModal;
