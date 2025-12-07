from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Any
import re

from app.services.file_service import FileService
from app.services.duckdb_service import DuckDBService
from app.services.agent_service import DataAgent
from app.utils.logger import log_event

router = APIRouter()

class QueryExecuteRequest(BaseModel):
    file_id: str
    query: str

class QueryExecuteResponse(BaseModel):
    columns: List[str]
    rows: List[List[Any]]
    totalRows: int

class AIAssistRequest(BaseModel):
    file_id: str
    prompt: str

class AIAssistResponse(BaseModel):
    query: str


def validate_select_query(query: str) -> bool:
    """SELECT 쿼리인지 검증"""
    # 주석 제거
    query_cleaned = re.sub(r'--.*$', '', query, flags=re.MULTILINE)
    query_cleaned = re.sub(r'/\*.*?\*/', '', query_cleaned, flags=re.DOTALL)
    query_cleaned = query_cleaned.strip().upper()
    
    # SELECT로 시작하는지 확인
    if not query_cleaned.startswith('SELECT'):
        return False
    
    # 위험한 키워드 검사
    dangerous_keywords = [
        'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
        'TRUNCATE', 'REPLACE', 'MERGE', 'GRANT', 'REVOKE'
    ]
    
    for keyword in dangerous_keywords:
        if re.search(rf'\b{keyword}\b', query_cleaned):
            return False
    
    return True


@router.post("/execute", response_model=QueryExecuteResponse)
async def execute_query(request: QueryExecuteRequest):
    """사용자 정의 SQL 쿼리 실행"""
    start_time = log_event("api", "execute_query_start", file_id=request.file_id)
    
    try:
        # 파일 메타데이터 조회
        file_metadata = await FileService.get_file_by_id(request.file_id)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
        
        # SELECT 쿼리인지 검증
        if not validate_select_query(request.query):
            raise HTTPException(
                status_code=400,
                detail="SELECT 쿼리만 실행할 수 있습니다. INSERT, UPDATE, DELETE 등은 사용할 수 없습니다."
            )
        
        # 쿼리 실행
        result = DuckDBService.execute_query(file_metadata.parquet_path, request.query)
        
        # 결과를 컬럼과 행으로 분리
        if result and len(result) > 0:
            columns = list(result[0].keys())
            rows = [[row[col] for col in columns] for row in result]
        else:
            columns = []
            rows = []
        
        log_event("api", "execute_query_complete", start_time=start_time, rows=len(rows))
        
        return QueryExecuteResponse(
            columns=columns,
            rows=rows,
            totalRows=len(rows)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_event("api", "execute_query_error", start_time=start_time, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-assist", response_model=AIAssistResponse)
async def ai_assist(request: AIAssistRequest):
    """AI를 활용한 쿼리 생성 도움"""
    start_time = log_event("api", "ai_assist_start", file_id=request.file_id)
    
    try:
        # 파일 메타데이터 조회
        file_metadata = await FileService.get_file_by_id(request.file_id)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
        
        # DataAgent를 사용하여 SQL 생성
        agent = DataAgent()
        sql_query = await agent.generate_sql(request.prompt, file_metadata)
        
        if not sql_query:
            raise HTTPException(status_code=400, detail="쿼리를 생성할 수 없습니다. 질문을 더 구체적으로 해주세요.")
        
        log_event("api", "ai_assist_complete", start_time=start_time, query=sql_query)
        
        return AIAssistResponse(query=sql_query)
        
    except HTTPException:
        raise
    except Exception as e:
        log_event("api", "ai_assist_error", start_time=start_time, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
