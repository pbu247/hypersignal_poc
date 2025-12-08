import os
import uuid
import shutil
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
        """파일에서 실제 사용된 인코딩 추출 (다국어 우선, chardet 보조)"""
        start_time = log_event("file", "detect_encoding_start", file_path=file_path)
        
        # 파일 전체 읽기
        file_size = os.path.getsize(file_path)
        sample_size = min(file_size, 2 * 1024 * 1024)  # 최대 2MB
        
        with open(file_path, 'rb') as f:
            raw_data = f.read(sample_size)
        
        # 1단계: 다국어(CJK) 우선 시도 - 한글, 중국어, 일본어 등
        priority_encodings = [
            'utf-8',        # 국제 표준
            'utf-8-sig',    # BOM 포함 UTF-8
            'cp949',        # Windows 한글
            'euc-kr',       # Unix 한글
            'shift-jis',    # 일본어
            'gb18030',      # 중국어 간체
            'big5',         # 중국어 번체
            'euc-jp',       # Unix 일본어
        ]
        
        for encoding in priority_encodings:
            try:
                decoded = raw_data.decode(encoding)
                # 다국어 문자가 포함되어 있는지 확인
                # UTF-8 계열이거나, 실제로 디코딩되면 사용
                log_event("file", "encoding_success", start_time=start_time, 
                         encoding=encoding, method="priority_cjk")
                return encoding
            except (UnicodeDecodeError, LookupError, AttributeError):
                continue
        
        # 2단계: chardet으로 감지 (다국어 실패 시)
        detected_encoding = None
        confidence = 0
        
        try:
            result = chardet.detect(raw_data)
            detected_encoding = result.get('encoding')
            confidence = result.get('confidence', 0)
            
            log_event("file", "chardet_detected", encoding=detected_encoding, confidence=confidence)
            
            if detected_encoding:
                # 인코딩 정규화
                detected_encoding = detected_encoding.lower()
                encoding_aliases = {
                    'ascii': 'utf-8',
                    'windows-1252': 'cp1252',
                    'iso-8859-1': 'latin1',
                    'euc_kr': 'euc-kr',
                    'euckr': 'euc-kr',
                }
                detected_encoding = encoding_aliases.get(detected_encoding, detected_encoding)
                
                # latin1은 마지막 수단으로만 사용 (다국어 깨짐)
                if detected_encoding != 'latin1' or confidence > 0.9:
                    try:
                        raw_data.decode(detected_encoding)
                        log_event("file", "encoding_success", start_time=start_time, 
                                 encoding=detected_encoding, confidence=confidence, method="chardet")
                        return detected_encoding
                    except (UnicodeDecodeError, LookupError, AttributeError) as e:
                        log_event("file", "chardet_decode_failed", encoding=detected_encoding, error=str(e))
        except Exception as e:
            log_event("file", "chardet_error", error=str(e))
        
        # 3단계: 기타 인코딩 시도
        fallback_encodings = ['iso-2022-kr', 'iso-2022-jp', 'cp1252']
        
        for encoding in fallback_encodings:
            try:
                raw_data.decode(encoding)
                log_event("file", "encoding_success", start_time=start_time, 
                         encoding=encoding, method="fallback")
                return encoding
            except (UnicodeDecodeError, LookupError, AttributeError):
                continue
        
        # 4단계: 최후의 수단 - UTF-8 (에러는 나중에 처리)
        log_event("file", "encoding_final_fallback", start_time=start_time, encoding='utf-8')
        return 'utf-8'
    
    @staticmethod
    def read_file_to_dataframe(file_path: str, filename: str) -> pd.DataFrame:
        """파일을 DataFrame으로 읽기"""
        start_time = log_event("file", "read_file_start", file_path=file_path)
        
        file_ext = Path(filename).suffix.lower()
        
        try:
            if file_ext == '.csv':
                # 1. 파일에서 실제 사용된 인코딩 추출
                detected_encoding = FileService.detect_encoding(file_path)
                log_event("file", "csv_read_start", encoding=detected_encoding)
                
                # 2. 감지된 인코딩으로 읽기 시도
                try:
                    df = pd.read_csv(file_path, encoding=detected_encoding)
                    log_event("file", "csv_read_success", encoding=detected_encoding, method="detected")
                except Exception as first_error:
                    log_event("file", "csv_detected_encoding_failed", 
                             encoding=detected_encoding, error=str(first_error))
                    
                    # 3. 감지된 인코딩 실패 시, errors 옵션 추가해서 재시도
                    try:
                        df = pd.read_csv(file_path, encoding=detected_encoding, encoding_errors='replace')
                        log_event("file", "csv_read_success", encoding=detected_encoding, method="detected_replace")
                    except Exception as second_error:
                        log_event("file", "csv_detected_with_replace_failed", error=str(second_error))
                        
                        # 4. 그래도 실패하면 일반적인 인코딩들 시도
                        fallback_encodings = ['utf-8', 'cp949', 'euc-kr', 'shift-jis', 'gb18030', 'latin1']
                        success = False
                        
                        for enc in fallback_encodings:
                            if enc == detected_encoding:
                                continue  # 이미 시도한 인코딩은 건너뛰기
                            
                            try:
                                df = pd.read_csv(file_path, encoding=enc, encoding_errors='replace')
                                log_event("file", "csv_read_success", encoding=enc, method="fallback")
                                success = True
                                break
                            except Exception:
                                continue
                        
                        if not success:
                            raise ValueError(f"CSV 파일을 읽을 수 없습니다. 감지된 인코딩: {detected_encoding}, 마지막 에러: {str(second_error)}")
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
    
    @staticmethod
    async def delete_file(file_id: str) -> bool:
        """파일 삭제 (파일 시스템 + 메타데이터)"""
        start_time = log_event("database", "delete_file_start", file_id=file_id)
        
        try:
            # 1. 메타데이터 조회
            file_metadata = await FileService.get_file_by_id(file_id)
            if not file_metadata:
                log_event("database", "delete_file_not_found", start_time=start_time)
                return False
            
            # 2. 파일 시스템에서 parquet 폴더 삭제
            if file_metadata.parquet_path and os.path.exists(file_metadata.parquet_path):
                shutil.rmtree(file_metadata.parquet_path)
                log_event("file", "delete_parquet_complete", parquet_path=file_metadata.parquet_path)
            
            # 3. 메타데이터 삭제
            collection = get_collection("file_metadata")
            await collection.delete_one({"file_id": file_id})
            
            log_event("database", "delete_file_complete", start_time=start_time)
            return True
            
        except Exception as e:
            log_event("database", "delete_file_error", start_time=start_time, error=str(e))
            raise
