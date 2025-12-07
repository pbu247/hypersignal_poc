from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import uuid
import os
import shutil
from typing import List

from app.models.schemas import FileMetadata, FileUploadResponse, ColumnInfo
from app.services.file_service import FileService
from app.utils.logger import log_event

router = APIRouter()


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """파일 업로드"""
    start_time = log_event("api", "upload_file_start", filename=file.filename)
    
    try:
        # 임시 파일 저장
        temp_path = f"/tmp/{uuid.uuid4()}_{file.filename}"
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 파일 읽기
        df = FileService.read_file_to_dataframe(temp_path, file.filename)
        
        # UUID 생성
        file_id = str(uuid.uuid4())
        
        # 버전 확인
        version = await FileService.get_file_version(file.filename)
        
        # 날짜 컬럼 감지
        date_column = FileService.detect_date_column(df)
        
        # Parquet 저장
        parquet_path, is_partitioned = await FileService.save_to_parquet(
            df, file_id, date_column
        )
        
        # 컬럼 정보 추출
        columns = FileService.extract_column_info(df)
        
        # 메타데이터 생성
        metadata = FileMetadata(
            file_id=file_id,
            filename=file.filename,
            original_filename=file.filename,
            version=version,
            file_size=os.path.getsize(temp_path),
            row_count=len(df),
            columns=columns,
            parquet_path=parquet_path,
            date_column=date_column,
            is_partitioned=is_partitioned
        )
        
        # 메타데이터 저장
        await FileService.save_metadata(metadata)
        
        # 임시 파일 삭제
        os.remove(temp_path)
        
        log_event("api", "upload_file_complete", start_time=start_time, file_id=file_id)
        
        return FileUploadResponse(
            file_id=file_id,
            filename=file.filename,
            version=version,
            row_count=len(df),
            columns=columns,
            message=f"파일이 성공적으로 업로드되었습니다. (버전: {version})"
        )
        
    except Exception as e:
        log_event("api", "upload_file_error", start_time=start_time, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_files():
    """파일 목록 조회"""
    start_time = log_event("api", "list_files_start")
    
    try:
        files = await FileService.get_all_files()
        log_event("api", "list_files_complete", start_time=start_time, count=len(files))
        return {"files": files}
        
    except Exception as e:
        log_event("api", "list_files_error", start_time=start_time, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{file_id}")
async def get_file(file_id: str):
    """파일 메타데이터 조회"""
    start_time = log_event("api", "get_file_start", file_id=file_id)
    
    try:
        file_metadata = await FileService.get_file_by_id(file_id)
        
        if not file_metadata:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
        
        log_event("api", "get_file_complete", start_time=start_time)
        return file_metadata
        
    except HTTPException:
        raise
    except Exception as e:
        log_event("api", "get_file_error", start_time=start_time, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{file_id}/data")
async def get_file_data(file_id: str, limit: int = 30):
    """파일의 실제 데이터 조회 (상위 N개 행)"""
    start_time = log_event("api", "get_file_data_start", file_id=file_id, limit=limit)
    
    try:
        from app.services.duckdb_service import DuckDBService
        
        # 파일 메타데이터 조회
        file_metadata = await FileService.get_file_by_id(file_id)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
        
        # DuckDB로 데이터 조회
        result = DuckDBService.execute_query(file_metadata.parquet_path, f"SELECT * FROM data LIMIT {limit}")
        
        log_event("api", "get_file_data_complete", start_time=start_time, row_count=len(result))
        
        return {
            "rows": result,
            "count": len(result)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_event("api", "get_file_data_error", start_time=start_time, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
