import duckdb
import os
from typing import List, Dict, Any, Optional
from pathlib import Path

from app.utils.logger import log_event


class DuckDBService:
    """DuckDB 쿼리 서비스"""
    
    @staticmethod
    def execute_query(parquet_path: str, query: str) -> List[Dict[str, Any]]:
        """DuckDB 쿼리 실행"""
        start_time = log_event("duckdb", "query_start", query=query)
        
        try:
            conn = duckdb.connect(database=':memory:')
            
            # Parquet 파일 로드
            if os.path.isdir(parquet_path):
                # 파티셔닝된 경우
                parquet_files = str(Path(parquet_path) / "**" / "*.parquet")
                conn.execute(f"CREATE TABLE data AS SELECT * FROM read_parquet('{parquet_files}')")
            else:
                # 단일 파일
                conn.execute(f"CREATE TABLE data AS SELECT * FROM read_parquet('{parquet_path}')")
            
            # 쿼리 실행
            result = conn.execute(query).fetchall()
            columns = [desc[0] for desc in conn.description]
            
            # 결과를 딕셔너리 리스트로 변환
            result_dicts = [dict(zip(columns, row)) for row in result]
            
            conn.close()
            
            log_event("duckdb", "query_complete", start_time=start_time, 
                     rows_returned=len(result_dicts))
            
            return result_dicts
            
        except Exception as e:
            log_event("duckdb", "query_error", start_time=start_time, error=str(e))
            raise
    
    @staticmethod
    def get_sample_data(parquet_path: str, limit: int = 10) -> List[Dict[str, Any]]:
        """샘플 데이터 조회"""
        query = f"SELECT * FROM data LIMIT {limit}"
        return DuckDBService.execute_query(parquet_path, query)
    
    @staticmethod
    def get_row_count(parquet_path: str) -> int:
        """전체 행 수 조회"""
        result = DuckDBService.execute_query(parquet_path, "SELECT COUNT(*) as count FROM data")
        return result[0]['count']
    
    @staticmethod
    def get_column_stats(parquet_path: str, column: str) -> Dict[str, Any]:
        """컬럼 통계 조회"""
        query = f"""
        SELECT 
            COUNT(*) as count,
            COUNT(DISTINCT {column}) as distinct_count,
            COUNT({column}) as non_null_count
        FROM data
        """
        result = DuckDBService.execute_query(parquet_path, query)
        return result[0] if result else {}
