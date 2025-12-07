from typing import Optional, List, Dict, Any
from openai import OpenAI
import os
import re

from app.services.duckdb_service import DuckDBService
from app.models.schemas import FileMetadata
from app.utils.logger import log_event


class DataAgent:
    """데이터 탐색 에이전트"""
    
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    def create_system_prompt(self, metadata: FileMetadata) -> str:
        """시스템 프롬프트 생성"""
        columns_info = "\n".join([
            f"- {col.name}: {col.type.value} (샘플: {col.sample_values[:2] if col.sample_values else 'N/A'})"
            for col in metadata.columns
        ])
        
        return f"""당신은 데이터 분석 전문가입니다. 사용자의 질문에 대해 SQL 쿼리를 생성하고 결과를 분석하여 답변합니다.

데이터 정보:
- 파일명: {metadata.filename}
- 전체 행 수: {metadata.row_count:,}
- 컬럼 정보:
{columns_info}

규칙:
1. 모든 SQL 쿼리는 "data" 테이블을 사용합니다.
2. 사용자의 질문이 모호하거나 의미가 없으면 재질문합니다.
3. 질문이 이 데이터와 관련이 없으면 데이터 관련 질문을 유도합니다.
4. SQL 쿼리는 ```sql ``` 코드 블록으로 작성합니다.
5. 답변은 한국어로 작성하며, 전문적이고 명확하게 작성합니다.
"""
    
    async def analyze_intent(self, user_message: str) -> str:
        """질문 의도 파악"""
        start_time = log_event("agent", "analyze_intent_start")
        
        # 데이터와 무관한 일반적인 인사/잡담 체크
        irrelevant_patterns = [
            r'^안녕', r'^hi$', r'^hello$', r'^헬로', r'^하이$',
            r'^ㅎㅇ', r'^ㅎㅇㅎㅇ', r'^하위', r'^하이하이',
            r'^어때', r'^어떄', r'^잘지내', r'^뭐해', r'^밥먹',
            r'^좋은', r'^감사', r'^고마워', r'^ㄱㅅ', r'^ㄳ'
        ]
        msg_lower = user_message.strip().lower()
        for pattern in irrelevant_patterns:
            if re.match(pattern, msg_lower):
                log_event("agent", "analyze_intent_complete", start_time=start_time, intent="irrelevant")
                return "irrelevant"
        
        # 의미 없는 질문 체크
        meaningless_patterns = [r'^[아어음ㅏㅓㅡ\s]+$', r'^[ㄱ-ㅎㅏ-ㅣ\s]+$']
        for pattern in meaningless_patterns:
            if re.match(pattern, user_message.strip()):
                log_event("agent", "analyze_intent_complete", start_time=start_time, intent="meaningless")
                return "meaningless"
        
        # 메타 정보 질문 체크
        meta_keywords = ['컬럼', '열', 'column', '필드', '데이터 종류', '어떤 정보']
        if any(keyword in user_message for keyword in meta_keywords):
            log_event("agent", "analyze_intent_complete", start_time=start_time, intent="metadata")
            return "metadata"
        
        log_event("agent", "analyze_intent_complete", start_time=start_time, intent="query")
        return "query"
    
    async def handle_metadata(self, metadata: FileMetadata) -> str:
        """메타데이터 질문 처리"""
        start_time = log_event("agent", "handle_metadata_start")
        
        columns_desc = []
        for col in metadata.columns:
            type_kr = {
                "string": "문자", "integer": "정수", "float": "실수 (소수점 포함)",
                "date": "날짜", "datetime": "날짜시간", "boolean": "참/거짓"
            }.get(col.type.value, col.type.value)
            
            sample = f" (예: {', '.join(map(str, col.sample_values[:2]))})" if col.sample_values else ""
            columns_desc.append(f"- {col.name}: {type_kr}{sample}")
        
        response = f"""이 데이터는 총 {metadata.row_count:,}개의 행으로 구성되어 있으며, 다음 {len(metadata.columns)}개의 컬럼을 포함합니다:

{chr(10).join(columns_desc)}"""
        
        log_event("agent", "handle_metadata_complete", start_time=start_time)
        return response
    
    async def generate_sql(self, user_message: str, metadata: FileMetadata) -> Optional[str]:
        """SQL 쿼리 생성"""
        start_time = log_event("agent", "generate_sql_start")
        
        try:
            system_prompt = self.create_system_prompt(metadata)
            
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"다음 질문에 대한 SQL 쿼리를 생성해주세요: {user_message}"}
                ],
                temperature=0
            )
            
            content = response.choices[0].message.content
            
            # SQL 추출
            sql_match = re.search(r'```sql\n(.*?)\n```', content, re.DOTALL)
            if sql_match:
                sql_query = sql_match.group(1).strip()
                log_event("agent", "generate_sql_complete", start_time=start_time, query=sql_query)
                return sql_query
            
            log_event("agent", "generate_sql_no_sql", start_time=start_time)
            return None
            
        except Exception as e:
            log_event("agent", "generate_sql_error", start_time=start_time, error=str(e))
            raise
    
    async def generate_response(self, user_message: str, metadata: FileMetadata, 
                               sql_query: Optional[str], query_result: Optional[List[Dict[str, Any]]]) -> str:
        """최종 응답 생성"""
        start_time = log_event("agent", "generate_response_start")
        
        try:
            system_prompt = self.create_system_prompt(metadata)
            
            result_text = ""
            if query_result:
                result_text = f"\n\n쿼리 결과:\n{query_result[:10]}"
            
            prompt = f"""사용자 질문: {user_message}

SQL 쿼리: {sql_query or 'N/A'}
{result_text}

위 결과를 바탕으로 사용자에게 명확하고 전문적인 답변을 작성해주세요."""
            
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0
            )
            
            content = response.choices[0].message.content
            log_event("agent", "generate_response_complete", start_time=start_time)
            return content
            
        except Exception as e:
            log_event("agent", "generate_response_error", start_time=start_time, error=str(e))
            raise
    
    async def generate_suggested_questions(self, metadata: FileMetadata) -> List[str]:
        """추천 질문 생성"""
        start_time = log_event("agent", "generate_suggestions_start")
        
        try:
            columns_info = ", ".join([col.name for col in metadata.columns[:5]])
            
            prompt = f"""다음 데이터에 대한 탐색적 질문 4개를 한국어로 생성해주세요:
- 파일: {metadata.filename}
- 행 수: {metadata.row_count:,}
- 주요 컬럼: {columns_info}

각 질문은 한 줄로 작성하고, 번호나 마크다운 없이 질문만 작성해주세요."""
            
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7
            )
            
            content = response.choices[0].message.content
            questions = [q.strip() for q in content.split('\n') if q.strip()][:4]
            
            log_event("agent", "generate_suggestions_complete", start_time=start_time)
            return questions
            
        except Exception as e:
            log_event("agent", "generate_suggestions_error", start_time=start_time, error=str(e))
            return [
                "전체 데이터의 요약 통계를 보여주세요.",
                "가장 많이 나타나는 값은 무엇인가요?",
                "데이터의 분포를 확인하고 싶습니다.",
                "특이한 패턴이나 이상치가 있나요?"
            ]
    
    async def process_query(
        self,
        user_message: str,
        file_metadata: FileMetadata
    ) -> tuple[str, Optional[str], Optional[List[str]]]:
        """쿼리 처리"""
        
        # 1. 의도 분석
        intent = await self.analyze_intent(user_message)
        
        # 2. 의도에 따른 처리
        if intent == "irrelevant":
            return "죄송합니다. 저는 데이터 분석 전문 AI입니다. 업로드된 데이터에 대한 질문을 해주세요. 예를 들어 '이 데이터에는 어떤 정보가 있나요?' 또는 '전체 데이터의 통계를 보여주세요' 같은 질문을 할 수 있습니다.", None, None
        
        elif intent == "meaningless":
            suggested = await self.generate_suggested_questions(file_metadata)
            response = f"""어떤 의미로 질문하신 걸까요?

다음과 같은 질문을 해보시는 건 어떨까요?

{chr(10).join(f"{i+1}. {q}" for i, q in enumerate(suggested))}"""
            return response, None, suggested
        
        elif intent == "metadata":
            response = await self.handle_metadata(file_metadata)
            return response, None, None
        
        else:  # query
            # 3. SQL 생성
            sql_query = await self.generate_sql(user_message, file_metadata)
            
            if not sql_query:
                return "죄송합니다. 질문을 이해하지 못했습니다. 다시 질문해주시겠어요?", None, None
            
            # 4. SQL 실행
            try:
                parquet_path = file_metadata.parquet_path
                query_result = DuckDBService.execute_query(parquet_path, sql_query)
            except Exception as e:
                return f"쿼리 실행 중 오류가 발생했습니다: {str(e)}", sql_query, None
            
            # 5. 응답 생성
            response = await self.generate_response(user_message, file_metadata, sql_query, query_result)
            
            return response, sql_query, None
