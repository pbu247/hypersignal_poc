import os
import uuid
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from datetime import datetime
from typing import List, Optional, Tuple
import chardet
from pathlib import Path

from app.models.schemas import FileMetadata, ColumnInfo, ColumnType
from app.utils.database import get_collection
from app.utils.logger import log_event


UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)


class FileService:
    """파일 처리 서비스"""
    
    @staticmethod
    def detect_encoding(file_path: str) -> str:
        """파일 인코딩 감지 (한국어 우선)"""
        start_time = log_event("file", "detect_encoding_start", file_path=file_path)
        
        # 한국어 파일에서 자주 사용되는 인코딩 순서대로 시도
        encodings_to_try = ['utf-8', 'cp949', 'euc-kr', 'utf-8-sig']
        
        with open(file_path, 'rb') as f:
            raw_data = f.read(100000)  # 첫 100KB 읽기
        
        # 먼저 일반적인 인코딩 시도
        for encoding in encodings_to_try:
            try:
                raw_data.decode(encoding)
                log_event("file", "detect_encoding_complete", start_time=start_time, encoding=encoding)
                return encoding
            except (UnicodeDecodeError, LookupError):
                continue
        
        # 위 방법이 실패하면 chardet 사용
        result = chardet.detect(raw_data)
        detected_encoding = result['encoding']
        
        # chardet이 잘못된 인코딩을 반환할 수 있으므로 검증
        try:
            raw_data.decode(detected_encoding)
            log_event("file", "detect_encoding_complete", start_time=start_time, encoding=detected_encoding)
            return detected_encoding
        except (UnicodeDecodeError, LookupError, TypeError):
            # 최종 fallback
            log_event("file", "detect_encoding_complete", start_time=start_time, encoding='utf-8')
            return 'utf-8'
    
    @staticmethod
    def read_file_to_dataframe(file_path: str, filename: str) -> pd.DataFrame:
        """파일을 DataFrame으로 읽기"""
        start_time = log_event("file", "read_file_start", file_path=file_path)
        
        file_ext = Path(filename).suffix.lower()
        
        try:
            if file_ext == '.csv':
                encoding = FileService.detect_encoding(file_path)
                try:
                    df = pd.read_csv(file_path, encoding=encoding)
                except (UnicodeDecodeError, pd.errors.ParserError):
                    # 인코딩 실패 시 encoding_errors='replace'로 재시도
                    df = pd.read_csv(file_path, encoding=encoding, encoding_errors='replace')
            elif file_ext in ['.xlsx', '.xls']:
                df = pd.read_excel(file_path)
            elif file_ext == '.parquet':
                df = pd.read_parquet(file_path)
            else:
                raise ValueError(f"지원하지 않는 파일 형식: {file_ext}")
            
            log_event("file", "read_file_complete", start_time=start_time, rows=len(df))
            return df
            
        except Exception as e:
            log_event("file", "read_file_error", start_time=start_time, error=str(e))
            raise
    
    @staticmethod
    def detect_column_type(series: pd.Series) -> ColumnType:
        """컬럼 타입 감지"""
        dtype = str(series.dtype)
        
        if 'int' in dtype:
            return ColumnType.INTEGER
        elif 'float' in dtype:
            return ColumnType.FLOAT
        elif 'datetime' in dtype or 'date' in dtype:
            return ColumnType.DATE
        elif 'bool' in dtype:
            return ColumnType.BOOLEAN
        else:
            return ColumnType.STRING
    
    @staticmethod
    def detect_date_column(df: pd.DataFrame) -> Optional[str]:
        """날짜 컬럼 감지"""
        for col in df.columns:
            if 'date' in col.lower() or 'time' in col.lower() or '일자' in col or '날짜' in col:
                try:
                    pd.to_datetime(df[col])
                    return col
                except:
                    continue
        return None
    
    @staticmethod
    def extract_column_info(df: pd.DataFrame) -> List[ColumnInfo]:
        """컬럼 정보 추출"""
        columns = []
        for col in df.columns:
            col_type = FileService.detect_column_type(df[col])
            sample_values = df[col].dropna().head(3).tolist()
            
            columns.append(ColumnInfo(
                name=col,
                type=col_type,
                nullable=df[col].isnull().any(),
                sample_values=sample_values
            ))
        return columns
    
    @staticmethod
    async def save_to_parquet(
        df: pd.DataFrame,
        file_id: str,
        date_column: Optional[str] = None
    ) -> Tuple[str, bool]:
        """Parquet 파일로 저장"""
        start_time = log_event("file", "save_parquet_start", file_id=file_id)
        
        parquet_dir = os.path.join(UPLOAD_DIR, file_id)
        os.makedirs(parquet_dir, exist_ok=True)
        
        is_partitioned = False
        
        try:
            if date_column and date_column in df.columns:
                # 날짜 컬럼이 있으면 파티셔닝
                df[date_column] = pd.to_datetime(df[date_column])
                df['year'] = df[date_column].dt.year
                df['month'] = df[date_column].dt.month
                
                table = pa.Table.from_pandas(df)
                pq.write_to_dataset(
                    table,
                    root_path=parquet_dir,
                    partition_cols=['year', 'month']
                )
                is_partitioned = True
            else:
                # 파티셔닝 없이 저장
                parquet_path = os.path.join(parquet_dir, "data.parquet")
                df.to_parquet(parquet_path, engine='pyarrow', index=False)
            
            log_event("file", "save_parquet_complete", start_time=start_time, 
                     is_partitioned=is_partitioned)
            
            return parquet_dir, is_partitioned
            
        except Exception as e:
            log_event("file", "save_parquet_error", start_time=start_time, error=str(e))
            raise
    
    @staticmethod
    async def get_file_version(filename: str) -> int:
        """파일 버전 확인"""
        collection = get_collection("file_metadata")
        
        existing_file = await collection.find_one(
            {"original_filename": filename},
            sort=[("version", -1)]
        )
        
        if existing_file:
            return existing_file["version"] + 1
        return 1
    
    @staticmethod
    async def save_metadata(metadata: FileMetadata):
        """메타데이터 저장"""
        start_time = log_event("database", "save_metadata_start", file_id=metadata.file_id)
        
        collection = get_collection("file_metadata")
        
        metadata_dict = metadata.model_dump()
        metadata_dict["created_at"] = datetime.utcnow()
        metadata_dict["updated_at"] = datetime.utcnow()
        
        await collection.insert_one(metadata_dict)
        
        log_event("database", "save_metadata_complete", start_time=start_time)
    
    @staticmethod
    async def get_all_files() -> List[FileMetadata]:
        """모든 파일 메타데이터 조회"""
        start_time = log_event("database", "get_all_files_start")
        
        collection = get_collection("file_metadata")
        cursor = collection.find().sort("created_at", -1)
        
        files = []
        async for doc in cursor:
            doc.pop("_id", None)
            files.append(FileMetadata(**doc))
        
        log_event("database", "get_all_files_complete", start_time=start_time, count=len(files))
        return files
    
    @staticmethod
    async def get_file_by_id(file_id: str) -> Optional[FileMetadata]:
        """파일 ID로 메타데이터 조회"""
        start_time = log_event("database", "get_file_by_id_start", file_id=file_id)
        
        collection = get_collection("file_metadata")
        doc = await collection.find_one({"file_id": file_id})
        
        if doc:
            doc.pop("_id", None)
            log_event("database", "get_file_by_id_complete", start_time=start_time)
            return FileMetadata(**doc)
        
        log_event("database", "get_file_by_id_not_found", start_time=start_time)
        return None
