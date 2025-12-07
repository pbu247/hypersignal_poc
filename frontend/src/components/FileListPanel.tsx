import React, { useState, useRef } from 'react';
import { 
  ArrowUpTrayIcon, 
  DocumentTextIcon, 
} from '@heroicons/react/24/outline';
import type { FileMetadata } from '../types';
import { filesApi } from '../services/api';

interface FileListPanelProps {
  files: FileMetadata[];
  selectedFile: FileMetadata | null;
  onFileSelect: (file: FileMetadata) => void;
  onFileUploaded: () => void;
}

const FileListPanel: React.FC<FileListPanelProps> = ({
  files,
  selectedFile,
  onFileSelect,
  onFileUploaded,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadProgress(0);

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      await filesApi.upload(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        onFileUploaded();
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 500);
    } catch (error) {
      console.error('File upload failed:', error);
      setUploading(false);
      setUploadProgress(0);
      alert('파일 업로드에 실패했습니다.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  // 같은 파일명 그룹핑 및 버전 정보 계산
  const getFileGroups = () => {
    const groups = new Map<string, FileMetadata[]>();
    files.forEach(file => {
      const baseName = file.filename;
      if (!groups.has(baseName)) {
        groups.set(baseName, []);
      }
      groups.get(baseName)!.push(file);
    });

    // 각 그룹을 업로드 시간 기준으로 정렬 (최신이 먼저)
    groups.forEach((fileList) => {
      fileList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });

    return groups;
  };

  const fileGroups = getFileGroups();

  return (
    <div 
      className="w-64 border-l flex flex-col"
      style={{
        backgroundColor: '#1a1f2e',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Header */}
      <div className="p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.parquet"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          style={{
            background: uploading ? 'var(--border)' : 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
            color: 'white',
            border: 'none',
            cursor: uploading ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!uploading) {
              e.currentTarget.style.background = 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!uploading) {
              e.currentTarget.style.background = 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          <ArrowUpTrayIcon className="w-4 h-4" />
          <span>{uploading ? `${uploadProgress}%` : '파일 업로드'}</span>
        </button>
        
        {uploading && (
          <div className="mt-2 w-full rounded-full h-1 overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${uploadProgress}%`,
                backgroundColor: 'var(--primary)',
              }}
            />
          </div>
        )}
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div 
            className="flex flex-col items-center justify-center py-8 px-4 text-center"
            style={{ color: 'var(--text-secondary)' }}
          >
            <DocumentTextIcon className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">파일 없음</p>
          </div>
        ) : (
          <div className="py-2">
            {Array.from(fileGroups.entries()).map(([, fileList]) => {
              const hasMultipleVersions = fileList.length > 1;
              return fileList.map((file, versionIndex) => {
                const versionNumber = fileList.length - versionIndex;
                return (
                  <button
                    key={file.file_id}
                    onClick={() => onFileSelect(file)}
                    className="w-full px-3 py-2.5 text-left transition-all duration-200"
                    style={{
                      backgroundColor: selectedFile?.file_id === file.file_id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      borderLeft: selectedFile?.file_id === file.file_id ? '4px solid var(--primary)' : '4px solid transparent',
                      boxShadow: selectedFile?.file_id === file.file_id ? 'inset 0 0 0 1px rgba(59, 130, 246, 0.2)' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedFile?.file_id !== file.file_id) {
                        e.currentTarget.style.backgroundColor = 'var(--background)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedFile?.file_id !== file.file_id) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div 
                      className="text-sm mb-1 truncate flex items-center gap-2"
                      style={{ color: 'var(--text)' }}
                    >
                      <DocumentTextIcon className="w-4 h-4 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                      <span className="flex-1 truncate">{file.filename}</span>
                      {hasMultipleVersions && (
                        <span 
                          className="px-2 py-0.5 rounded-full text-xs font-bold shrink-0"
                          style={{
                            background: versionIndex === 0 
                              ? 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)'
                              : 'var(--surface)',
                            color: versionIndex === 0 ? 'white' : 'var(--text-secondary)',
                            border: versionIndex === 0 ? 'none' : '1px solid var(--border)',
                          }}
                        >
                          v{versionNumber}
                        </span>
                      )}
                    </div>
                    <div 
                      className="text-xs ml-6"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <div>{formatNumber(file.row_count)}행 · {file.columns.length}열</div>
                      <div className="mt-0.5">{formatFileSize(file.file_size)}</div>
                      <div className="mt-0.5">{new Date(file.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </button>
                );
              });
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileListPanel;
