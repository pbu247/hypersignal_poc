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
    
    def create_system_prompt(self, metadata: FileMetadata, conversation_history: Optional[List[Dict[str, str]]] = None) -> str:
        """시스템 프롬프트 생성"""
        columns_info = "\n".join([
            f"- {col.name}: {col.type.value} (샘플: {col.sample_values[:2] if col.sample_values else 'N/A'})"
            for col in metadata.columns
        ])
        
        # 컬럼명 리스트 (정확히 명시)
        column_names = [col.name for col in metadata.columns]
        column_names_str = "\n".join([f'  {i+1}. "{name}"' for i, name in enumerate(column_names)])
        
        # SQL 예시 생성 (첫 3개 컬럼 사용)
        example_columns = [f'"{col.name}"' for col in metadata.columns[:3]]
        sql_example = f"SELECT {', '.join(example_columns)} FROM data LIMIT 10"
        
        history_context = ""
        if conversation_history:
            history_context = "\n\n이전 대화 내용:\n" + "\n".join([
                f"{msg['role']}: {msg['content'][:100]}..."
                for msg in conversation_history[-3:]  # 최근 3개만
            ])
        
        return f"""당신은 데이터 분석 전문가입니다. 사용자의 질문에 대해 SQL 쿼리를 생성하고 결과를 분석하여 답변합니다.

선택하신 데이터 정보:
- 파일명: {metadata.filename}
- 전체 행 수: {metadata.row_count:,}개
- 컬럼 정보:
{columns_info}

⚠️ **중요: 사용 가능한 컬럼명 (이 컬럼들만 사용 가능)**
{column_names_str}

**SQL 작성 규칙:**
1. 모든 SQL 쿼리는 "data" 테이블을 사용합니다.
2. **컬럼명은 반드시 위 리스트에서 정확히 복사하여 큰따옴표(")로 감싸야 합니다.**
3. **예시: {sql_example}**
4. **절대로 컬럼명을 추측하거나 변형하지 마세요.**
5. 컬럼명에 괄호가 있으면 괄호까지 정확히 포함해야 합니다.
   - 예: "가시거리(m)", "온도(섭씨)", "풍속(meter per second)" - 괄호 안의 내용까지 정확히 사용
6. **컬럼명 별칭 규칙 (매우 중요):**
   - 원본 컬럼을 그대로 사용할 때: 별칭 없이 사용 (예: SELECT "온도(섭씨)" FROM data)
   - 집계 함수 사용 시: "함수명_원본컬럼명" 형식 (예: AVG("온도(섭씨)") AS "평균_온도(섭씨)")
   - 나쁜 예: "평균온도", "온도평균", "avg_temp" ❌
   - 좋은 예: "평균_온도(섭씨)", "최대_풍속(meter per second)", "합계_강수량(mm)" ✓
7. **데이터 요약 및 차트 생성 규칙:**
   - 일자/시간 컬럼이 있으면 반드시 기준으로 사용 (GROUP BY "날짜", "월" 등)
   - 전체 통계(평균, 최대, 최소 등)는 차트 대신 표로 제공
   - 차트는 시계열 추이, 카테고리별 비교, 분포 분석에만 사용
8. 사용자가 요청한 컬럼이 리스트에 없으면 "해당 컬럼이 데이터에 없습니다"라고 답변하세요.
9. 이전 대화 내용을 참고하여 맥락을 이해하고 답변합니다.
10. 사용자의 질문이 모호하면 어떤 컬럼에 대한 질문인지 명확히 물어봅니다.
11. 질문이 이 데이터와 관련이 없으면 데이터 관련 질문을 유도합니다.
12. SQL 쿼리는 ```sql ``` 코드 블록으로 작성합니다.
13. 답변은 한국어로 작성하며, 사용자 친화적이고 명확하게 작성합니다.
14. "데이터베이스에서", "조회한 결과" 같은 기술적 표현 대신 "선택하신 데이터를 살펴본 결과", "데이터를 분석한 결과" 등 자연스러운 표현을 사용합니다.
15. 데이터 결과가 시각화에 적합한 경우 (시계열, 비교, 분포 등) 차트로 보여줄지 물어봅니다.
16. 대화는 연속적으로 이어져야 하며, 이전 대화의 맥락을 반영하여 답변합니다.
{history_context}
"""
    
    async def analyze_intent(self, user_message: str, metadata: Optional[FileMetadata] = None) -> str:
        """질문 의도 빠르게 파악 (패턴 기반, GPT 미사용)"""
        msg = user_message.strip()
        msg_lower = msg.lower()
        
        # 너무 짧은 입력 (1-2글자)는 의미 없음
        if len(msg) <= 2:
            return "meaningless"
        
        # ? 만 입력한 경우
        if msg in ['?', '?', '。']:
            return "question_mark"
        
        # 데이터와 무관한 일반적인 인사/잡담 체크
        irrelevant_patterns = [
            r'^안녕', r'^hi$', r'^hello$', r'^헬로', r'^하이$',
            r'^ㅎㅇ', r'^ㅎㅇㅎㅇ', r'^하위', r'^하이하이',
            r'^어때', r'^어떄', r'^잘지내', r'^뭐해', r'^밥먹',
            r'^좋은', r'^감사', r'^고마워', r'^ㄱㅅ', r'^ㄳ'
        ]
        for pattern in irrelevant_patterns:
            if re.match(pattern, msg_lower):
                return "irrelevant"
        
        # 의미 없는 질문 체크 (자음/모음만, 랜덤 입력 등)
        meaningless_patterns = [
            r'^[아어음ㅏㅓㅡ\s]+$',  # 모음만
            r'^[ㄱ-ㅎㅏ-ㅣ\s]+$',    # 자음/모음만
            r'^[ㅁㄴㅇㄹㅎㅋㅌㅊㅍㅅㅂㅈㄷㄱ]+$',  # 자음만
        ]
        for pattern in meaningless_patterns:
            if re.match(pattern, msg):
                return "meaningless"
        
        # 자음/모음이 섞여있으면 meaningless (완성 한글이 있어도)
        jamo_count = len(re.findall(r'[ㄱ-ㅎㅏ-ㅣ]', msg))  # 자음/모음 개수
        
        # 자음/모음이 1개 이상 포함되어 있으면 무의미한 입력으로 간주
        if jamo_count >= 1:
            return "meaningless"
        
        # 의미 있는 한글 단어가 하나도 없으면 meaningless
        if len(msg) >= 3 and not re.search(r'[가-힣]{2,}', msg):
            return "meaningless"
        
        # 파일명/컬럼명 관련 질문인지 확인 (metadata가 있을 경우만)
        if metadata:
            # 파일명에서 키워드 추출 (확장자 제거)
            filename_base = metadata.filename.rsplit('.', 1)[0].lower()
            filename_keywords = re.findall(r'[가-힣a-z0-9]+', filename_base)
            
            # 컬럼명에서 키워드 추출
            column_keywords = []
            for col in metadata.columns:
                # 컬럼명에서 괄호 안 내용 제거하고 단어 추출
                col_clean = re.sub(r'\([^)]*\)', '', col.name.lower())
                keywords = re.findall(r'[가-힣a-z0-9]+', col_clean)
                column_keywords.extend(keywords)
            
            # 질문에 파일명 또는 컬럼명 키워드가 포함되어 있는지 확인
            has_filename_match = any(keyword in msg_lower for keyword in filename_keywords if len(keyword) >= 2)
            has_column_match = any(keyword in msg_lower for keyword in column_keywords if len(keyword) >= 2)
            
            # 데이터 분석 관련 키워드
            analysis_keywords = ['평균', '최대', '최소', '합계', '개수', '분포', '추이', '비교', '분석', '조회', '검색', 
                               '몇', '얼마', '언제', '어디', '어떤', '총', '전체', '상위', '하위', '많은', '적은',
                               '높은', '낮은', '크', '작', '증가', '감소', '변화', '차이']
            has_analysis_keyword = any(keyword in msg for keyword in analysis_keywords)
            
            # 파일명/컬럼명 키워드가 없고 분석 키워드도 없으면 관련 없는 질문
            if not has_filename_match and not has_column_match and not has_analysis_keyword:
                return "unrelated_to_data"
        
        # 설명형 질문 체크 ("이건 뭐야?", "이게 뭐지?")
        explanation_patterns = [
            r'이건?\s*뭐', r'이게?\s*뭔', r'저건?\s*뭔',
            r'뭐야\??$', r'뭔지\??$', r'어떤\s*데이터', r'어떤\s*정보',
            r'설명', r'알려줘', r'뭘까'
        ]
        for pattern in explanation_patterns:
            if re.search(pattern, msg):
                return "explanation"
        
        # 메타 정보 질문 체크
        meta_keywords = ['컬럼', '열', 'column', '필드', '데이터 종류', '어떤 정보']
        if any(keyword in msg for keyword in meta_keywords):
            return "metadata"
        
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
    
    async def handle_explanation(self, metadata: FileMetadata, user_message: str) -> str:
        """설명형 질문 처리 - 데이터가 무엇인지 설명"""
        start_time = log_event("agent", "handle_explanation_start")
        
        # 샘플 데이터 조회 (상위 5개)
        try:
            parquet_path = metadata.parquet_path
            query_result = DuckDBService.execute_query(parquet_path, "SELECT * FROM data LIMIT 5")
            
            columns_desc = []
            for col in metadata.columns:
                type_kr = {
                    "string": "문자", "integer": "정수", "float": "실수",
                    "date": "날짜", "datetime": "날짜시간", "boolean": "참/거짓"
                }.get(col.type.value, col.type.value)
                columns_desc.append(f"- {col.name} ({type_kr})")
            
            # 테이블 형태로 샘플 데이터 생성
            table_rows = []
            if query_result:
                # 헤더
                headers = list(query_result[0].keys())
                table_rows.append("| " + " | ".join(headers) + " |")
                table_rows.append("| " + " | ".join(["---"] * len(headers)) + " |")
                
                # 데이터 (상위 5개)
                for row in query_result[:5]:
                    values = [str(v) if v is not None else "-" for v in row.values()]
                    table_rows.append("| " + " | ".join(values) + " |")
            
            response = f"""선택하신 데이터를 살펴본 결과입니다.

**포함된 정보:**
{chr(10).join(columns_desc)}

**데이터 샘플 (상위 5개):**
{chr(10).join(table_rows)}"""
            
            log_event("agent", "handle_explanation_complete", start_time=start_time)
            return response
            
        except Exception as e:
            log_event("agent", "handle_explanation_error", start_time=start_time, error=str(e))
            return f"""선택하신 데이터는 {metadata.filename} 파일로, {metadata.row_count:,}개의 행과 {len(metadata.columns)}개의 컬럼으로 구성되어 있습니다.

어떤 분석을 원하시나요?"""
    
    async def generate_sql(self, user_message: str, metadata: FileMetadata, conversation_history: Optional[List[Dict[str, str]]] = None) -> Optional[str]:
        """SQL 쿼리 생성"""
        start_time = log_event("agent", "generate_sql_start")
        
        try:
            system_prompt = self.create_system_prompt(metadata, conversation_history)
            
            messages = [{"role": "system", "content": system_prompt}]
            
            # 대화 히스토리 추가 (최근 3개)
            if conversation_history:
                for msg in conversation_history[-3:]:
                    messages.append({"role": msg["role"], "content": msg["content"]})
            
            messages.append({"role": "user", "content": f"다음 질문에 대한 SQL 쿼리를 생성해주세요: {user_message}"})
            
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=messages,
                temperature=0
            )
            
            content = response.choices[0].message.content
            
            # SQL 추출
            sql_match = re.search(r'```sql\n(.*?)\n```', content, re.DOTALL)
            if sql_match:
                sql_query = sql_match.group(1).strip()
                
                # 일반적인 SQL 오류 패턴 수정
                # 1. GROUP BY 절에 SELECT의 비집계 컴럼이 없는 경우 수정
                # "표준코드명"을 SELECT하면서 GROUP BY에 없으면 추가하거나 ANY_VALUE로 감싸기
                if 'GROUP BY' in sql_query.upper():
                    # 간단한 경우: 마지막 SELECT에서 표준코드명만 선택하고 month만 GROUP BY하는 경우
                    # → 표준코드명을 GROUP BY에 추가
                    sql_query = self._fix_group_by_issue(sql_query)
                
                log_event("agent", "generate_sql_complete", start_time=start_time, query=sql_query)
                return sql_query
            
            log_event("agent", "generate_sql_no_sql", start_time=start_time)
            return None
            
        except Exception as e:
            log_event("agent", "generate_sql_error", start_time=start_time, error=str(e))
            raise
    
    async def generate_response(self, user_message: str, metadata: FileMetadata, 
                               sql_query: Optional[str], query_result: Optional[List[Dict[str, Any]]],
                               conversation_history: Optional[List[Dict[str, str]]] = None) -> tuple[str, Optional[Dict[str, Any]]]:
        """최종 응답 생성"""
        start_time = log_event("agent", "generate_response_start")
        
        try:
            system_prompt = self.create_system_prompt(metadata, conversation_history)
            
            result_text = ""
            chart_data = None
            
            if query_result:
                result_text = f"\n\n쿼리 결과 (최대 10개):\n{query_result[:10]}"
                
                # 차트 데이터 생성 가능 여부 확인
                if len(query_result) > 0 and len(query_result) <= 100:
                    chart_data = self._prepare_chart_data(query_result, user_message)
            
            prompt = f"""사용자 질문: {user_message}

실행한 SQL 쿼리: {sql_query or 'N/A'}
{result_text}

위 분석 결과를 바탕으로 사용자에게 자연스럽고 친근한 답변을 작성해주세요.
- "데이터베이스에서", "조회한 결과" 같은 기술 용어는 피하고, "선택하신 데이터를 살펴본 결과", "데이터 분석 결과" 등 사용자 친화적인 표현을 사용하세요.
- 이전 대화의 맥락을 고려하여 연속적인 대화가 되도록 하세요.
- 결과를 간결하고 명확하게 설명하세요.
{'- 데이터가 시각화에 적합하다면 "차트로도 보여드릴까요?"라고 물어보세요.' if chart_data else ''}"""
            
            messages = [{"role": "system", "content": system_prompt}]
            
            # 대화 히스토리 추가
            if conversation_history:
                for msg in conversation_history[-3:]:
                    messages.append({"role": msg["role"], "content": msg["content"]})
            
            messages.append({"role": "user", "content": prompt})
            
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=messages,
                temperature=0.7
            )
            
            content = response.choices[0].message.content
            log_event("agent", "generate_response_complete", start_time=start_time)
            return content, chart_data
            
        except Exception as e:
            log_event("agent", "generate_response_error", start_time=start_time, error=str(e))
            raise
    
    async def process_query_fast(self, user_message: str, metadata: FileMetadata, 
                                 conversation_history: Optional[List[Dict[str, str]]] = None) -> tuple[str, Optional[str], Optional[Dict[str, Any]]]:
        """빠른 쿼리 처리: SQL 생성 + 실행 + 응답을 한 번에"""
        start_time = log_event("agent", "process_query_fast_start")
        
        try:
            # 1단계: SQL 생성
            sql_query, ai_response = await self._generate_sql(user_message, metadata, conversation_history)
            
            if not sql_query:
                return ai_response, None, None
            
            # 2단계: SQL 실행
            query_result = await self._execute_sql(sql_query, metadata)
            
            if query_result is None:
                return f"데이터 조회 중 오류가 발생했습니다.", sql_query, None
            
            # 3단계: 결과 처리
            response_text, chart_data = await self._process_result(query_result, ai_response, user_message)
            
            log_event("agent", "process_query_fast_complete", start_time=start_time)
            return response_text, sql_query, chart_data
            
        except Exception as e:
            log_event("agent", "process_query_fast_error", start_time=start_time, error=str(e))
            raise
    
    async def _generate_sql(self, user_message: str, metadata: FileMetadata, 
                           conversation_history: Optional[List[Dict[str, str]]] = None) -> tuple[Optional[str], str]:
        """SQL 쿼리 생성"""
        system_prompt = self.create_system_prompt(metadata, conversation_history)
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # 대화 히스토리 추가 (최근 3개)
        if conversation_history:
            for msg in conversation_history[-3:]:
                messages.append({"role": msg["role"], "content": msg["content"]})
        
        # 한 번에 SQL과 응답 요청
        prompt = f"""사용자 질문: {user_message}

다음 순서로 답변해주세요:
1. 먼저 SQL 쿼리를 ```sql ``` 코드 블록으로 작성
2. 그 다음 사용자에게 보낼 자연스러운 답변 작성 (SQL 실행 결과는 시스템이 자동으로 추가합니다)

답변 형식:
```sql
SELECT ...
```

데이터를 분석한 결과를 바탕으로 사용자 친화적인 답변을 작성하세요."""
        
        messages.append({"role": "user", "content": prompt})
        
        response = self.client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=messages,
            temperature=0.3
        )
        
        content = response.choices[0].message.content
        
        # SQL 추출
        sql_match = re.search(r'```sql\n(.*?)\n```', content, re.DOTALL)
        if not sql_match:
            return None, content
        
        sql_query = sql_match.group(1).strip()
        
        # GROUP BY 이슈 수정
        if 'GROUP BY' in sql_query.upper():
            sql_query = self._fix_group_by_issue(sql_query)
        
        return sql_query, content
    
    async def _execute_sql(self, sql_query: str, metadata: FileMetadata):
        """SQL 실행"""
        from app.services.duckdb_service import DuckDBService
        try:
            query_result = DuckDBService.execute_query(metadata.parquet_path, sql_query)
            return query_result
        except Exception as e:
            logger.error(f"SQL execution error: {e}")
            return None
    
    async def _process_result(self, query_result, ai_response: str, user_message: str) -> tuple[str, Optional[Dict[str, Any]]]:
        """결과 처리 및 차트 데이터 생성"""
        # 차트 데이터 생성
        chart_data = None
        if query_result and len(query_result) > 0 and len(query_result) <= 100:
            chart_data = self._prepare_chart_data(query_result, user_message)
        
        # SQL 이후의 응답 텍스트 추출
        response_text = ai_response.split('```')[-1].strip()
        if not response_text or len(response_text) < 10:
            # SQL만 있고 답변이 없는 경우, 기본 응답 생성
            response_text = f"데이터를 분석한 결과입니다.\n\n조회된 데이터: {len(query_result)}건"
        
        # 결과 요약 추가
        if query_result:
            result_summary = f"\n\n**조회 결과:** {len(query_result)}건"
            if len(query_result) > 0:
                # 첫 5개 결과 추가
                result_summary += "\n\n"
                for i, row in enumerate(query_result[:5]):
                    if i == 0:
                        result_summary += "| " + " | ".join([str(k) for k in row.keys()]) + " |\n"
                        result_summary += "| " + " | ".join(["---"] * len(row.keys())) + " |\n"
                    result_summary += "| " + " | ".join([str(v) for v in row.values()]) + " |\n"
                
                if len(query_result) > 5:
                    result_summary += f"\n*...외 {len(query_result) - 5}건*"
            
            response_text += result_summary
        
        return response_text, chart_data
    
    def _old_process_query_fast(self, user_message: str, metadata: FileMetadata, 
                                 conversation_history: Optional[List[Dict[str, str]]] = None) -> tuple[str, Optional[str], Optional[Dict[str, Any]]]:
        """빠른 쿼리 처리: SQL 생성 + 실행 + 응답을 한 번에 (DEPRECATED - 위의 분리된 버전 사용)"""
        start_time = log_event("agent", "process_query_fast_start")
        
        try:
            system_prompt = self.create_system_prompt(metadata, conversation_history)
            
            messages = [{"role": "system", "content": system_prompt}]
            
            # 대화 히스토리 추가 (최근 3개)
            if conversation_history:
                for msg in conversation_history[-3:]:
                    messages.append({"role": msg["role"], "content": msg["content"]})
            
            # 한 번에 SQL과 응답 요청
            prompt = f"""사용자 질문: {user_message}

다음 순서로 답변해주세요:
1. 먼저 SQL 쿼리를 ```sql ``` 코드 블록으로 작성
2. 그 다음 사용자에게 보낼 자연스러운 답변 작성 (SQL 실행 결과는 시스템이 자동으로 추가합니다)

답변 형식:
```sql
SELECT ...
```

데이터를 분석한 결과를 바탕으로 사용자 친화적인 답변을 작성하세요."""
            
            messages.append({"role": "user", "content": prompt})
            
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=messages,
                temperature=0.3
            )
            
            content = response.choices[0].message.content
            
            # SQL 추출
            sql_match = re.search(r'```sql\n(.*?)\n```', content, re.DOTALL)
            if not sql_match:
                return content, None, None
            
            sql_query = sql_match.group(1).strip()
            
            # GROUP BY 이슈 수정
            if 'GROUP BY' in sql_query.upper():
                sql_query = self._fix_group_by_issue(sql_query)
            
            # SQL 실행
            from app.services.duckdb_service import DuckDBService
            try:
                query_result = DuckDBService.execute_query(metadata.parquet_path, sql_query)
            except Exception as e:
                error_msg = f"데이터 조회 중 오류가 발생했습니다: {str(e)}"
                log_event("agent", "process_query_fast_sql_error", start_time=start_time, error=str(e))
                return error_msg, sql_query, None
            
            # 차트 데이터 생성
            chart_data = None
            if query_result and len(query_result) > 0 and len(query_result) <= 100:
                chart_data = self._prepare_chart_data(query_result, user_message)
            
            # SQL 이후의 응답 텍스트 추출
            response_text = content.split('```')[-1].strip()
            if not response_text or len(response_text) < 10:
                # SQL만 있고 답변이 없는 경우, 기본 응답 생성
                response_text = f"데이터를 분석한 결과입니다.\n\n조회된 데이터: {len(query_result)}건"
            
            # 결과 요약 추가
            if query_result:
                result_summary = f"\n\n**조회 결과:** {len(query_result)}건"
                if len(query_result) > 0:
                    # 첫 5개 결과 추가
                    result_summary += "\n\n"
                    for i, row in enumerate(query_result[:5]):
                        if i == 0:
                            result_summary += "| " + " | ".join([str(k) for k in row.keys()]) + " |\n"
                            result_summary += "| " + " | ".join(["---"] * len(row.keys())) + " |\n"
                        result_summary += "| " + " | ".join([str(v) for v in row.values()]) + " |\n"
                    
                    if len(query_result) > 5:
                        result_summary += f"\n*...외 {len(query_result) - 5}건*"
                
                response_text += result_summary
            
            log_event("agent", "process_query_fast_complete", start_time=start_time)
            return response_text, sql_query, chart_data
            
        except Exception as e:
            log_event("agent", "process_query_fast_error", start_time=start_time, error=str(e))
            raise
    
    def _fix_group_by_issue(self, sql_query: str) -> str:
        """GROUP BY 절 오류 자동 수정"""
        try:
            # 마지막 SELECT 문에서 표준코드명이 있고, GROUP BY에 month만 있는 경우
            # → 표준코드명을 ANY_VALUE로 감싸기
            lines = sql_query.split('\n')
            result_lines = []
            in_final_select = False
            
            for i, line in enumerate(lines):
                # 마지막 SELECT 찾기 (CTE 이후의 SELECT)
                if 'SELECT' in line.upper() and i > len(lines) // 2:
                    in_final_select = True
                
                # 표준코드명이 있는 줄 찾기
                if in_final_select and '표준코드명' in line and 'ANY_VALUE' not in line and 'MAX(' not in line:
                    # GROUP BY 확인
                    group_by_line = None
                    for j in range(i, min(i + 10, len(lines))):
                        if 'GROUP BY' in lines[j].upper():
                            group_by_line = lines[j]
                            break
                    
                    # GROUP BY에 표준코드명이 없으면 ANY_VALUE로 감싸기
                    if group_by_line and '표준코드명' not in group_by_line:
                        line = line.replace('표준코드명,', 'ANY_VALUE(표준코드명) AS 표준코드명,')
                        line = line.replace('표준코드명\n', 'ANY_VALUE(표준코드명) AS 표준코드명\n')
                
                result_lines.append(line)
            
            return '\n'.join(result_lines)
        except:
            # 수정 실패시 원본 반환
            return sql_query
    

    
    def _prepare_chart_data(self, query_result: List[Dict[str, Any]], user_message: str = "") -> Optional[Dict[str, Any]]:
        """차트 데이터 준비 및 적절한 차트 타입 자동 결정"""
        if not query_result or len(query_result) == 0:
            return None
        
        # 첫 번째 행의 키 확인
        keys = list(query_result[0].keys())
        if len(keys) < 2:
            return None
        
        # 라벨과 값 추출
        labels = [str(row[keys[0]]) for row in query_result]
        
        # 숫자형 컬럼 찾기
        datasets = []
        for key in keys[1:]:
            values = []
            for row in query_result:
                val = row[key]
                if isinstance(val, (int, float)):
                    values.append(val)
                else:
                    break
            
            if len(values) == len(query_result):
                datasets.append({
                    "label": key,
                    "data": values
                })
        
        if not datasets:
            return None
        
        # 차트 타입 자동 결정 로직 (user_message 전달)
        chart_type = self._determine_chart_type(labels, datasets, keys[0], user_message)
        
        result = {
            "labels": labels,
            "datasets": datasets,
            "chart_type": chart_type
        }
        
        return result
    
    def _determine_chart_type(self, labels: List[str], datasets: List[Dict], first_column_name: str, user_message: str = "") -> str:
        """데이터 특성에 따라 적절한 차트 타입 결정"""
        num_labels = len(labels)
        num_datasets = len(datasets)
        
        # 사용자가 명시적으로 요청한 차트 타입 확인 (최우선)
        user_msg_lower = user_message.lower()
        if '파이' in user_msg_lower or 'pie' in user_msg_lower or '원그래프' in user_msg_lower:
            # 파이 차트는 단일 데이터셋에만 적용 가능
            if num_datasets == 1:
                return 'pie'
        elif '라인' in user_msg_lower or 'line' in user_msg_lower or '선' in user_msg_lower or '꺾은선' in user_msg_lower:
            return 'line'
        elif '막대' in user_msg_lower or 'bar' in user_msg_lower or '바' in user_msg_lower:
            return 'bar'
        elif '영역' in user_msg_lower or 'area' in user_msg_lower:
            return 'area'
        
        # 날짜/시간 관련 컬럼명 패턴
        time_patterns = ['날짜', '일자', '월', '년', '시간', 'date', 'time', 'month', 'year', 'day']
        is_time_series = any(pattern in first_column_name.lower() for pattern in time_patterns)
        
        # 1. 파이 차트 - 카테고리가 적고(10개 이하), 단일 데이터셋, 비율/분포 분석에 적합
        if num_labels <= 10 and num_datasets == 1 and not is_time_series:
            # 비율/점유율/분류/분포 관련 키워드
            percentage_patterns = ['비율', '점유', '분포', '구성', '분류', 'ratio', 'share', 'distribution', 'category']
            if any(pattern in first_column_name.lower() for pattern in percentage_patterns):
                return 'pie'
            # 집계 함수 사용 시 파이 차트 선호
            aggregation_patterns = ['건수', '개수', '수량', 'count', 'sum', '합계']
            if any(pattern in first_column_name.lower() for pattern in aggregation_patterns):
                return 'pie'
        
        # 2. 라인/영역 차트 - 시계열 데이터나 추세 분석
        if is_time_series:
            if num_datasets == 1:
                return 'area'  # 단일 시계열은 영역 차트로
            else:
                return 'line'  # 다중 시계열은 라인 차트로
        
        # 3. 콤보 차트 - 다중 데이터셋이고 값의 스케일이 다를 때
        if num_datasets >= 2:
            # 각 데이터셋의 평균값 계산
            avg_values = [sum(ds['data']) / len(ds['data']) for ds in datasets]
            max_avg = max(avg_values)
            min_avg = min(avg_values)
            
            # 스케일 차이가 10배 이상이면 콤보 차트 (첫 번째는 bar, 나머지는 line)
            if max_avg / min_avg > 10:
                for i, ds in enumerate(datasets):
                    ds['type'] = 'line' if i > 0 else 'bar'
                return 'combo'
        
        # 4. 바 차트 - 기본값 (카테고리별 비교)
        return 'bar'
    
    async def process_query(
        self,
        user_message: str,
        file_metadata: FileMetadata,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> tuple[str, Optional[str], Optional[List[str]], Optional[Dict[str, Any]]]:
        """쿼리 처리"""
        
        # 차트 요청 확인
        chart_request_patterns = [r'^응$', r'^네$', r'^예$', r'^yes$', r'^차트', r'^그래프', r'^시각화']
        is_chart_request = any(re.match(pattern, user_message.strip().lower()) for pattern in chart_request_patterns)
        
        # 1. 의도 분석
        intent = await self.analyze_intent(user_message)
        
        # 2. 의도에 따른 처리
        if intent == "question_mark":
            # ? 질문 처리
            suggested = await self.generate_suggested_questions(file_metadata)
            response = f"""무엇을 궁금해하시나요?

선택하신 파일({file_metadata.filename})에서 찾을 수 있는 정보들을 바탕으로 추천 질문을 준비했습니다:

{chr(10).join(f"{i+1}. {q}" for i, q in enumerate(suggested))}"""
            return response, None, suggested, None
        
        elif intent == "irrelevant" and not is_chart_request:
            return "죄송합니다. 저는 데이터 분석 전문 AI입니다. 업로드된 데이터에 대한 질문을 해주세요. 예를 들어 '이 데이터에는 어떤 정보가 있나요?' 또는 '전체 데이터의 통계를 보여주세요' 같은 질문을 할 수 있습니다.", None, None, None
        
        elif intent == "meaningless" and not is_chart_request:
            suggested = await self.generate_suggested_questions(file_metadata)
            response = f"""어떤 의미로 질문하신 걸까요?

다음과 같은 질문을 해보시는 건 어떨까요?

{chr(10).join(f"{i+1}. {q}" for i, q in enumerate(suggested))}"""
            return response, None, suggested, None
        
        elif intent == "explanation":
            # 설명형 질문 처리 - 샘플 데이터 보여주기
            response = await self.handle_explanation(file_metadata, user_message)
            return response, None, None, None
        
        elif intent == "metadata":
            response = await self.handle_metadata(file_metadata)
            return response, None, None, None
        
        else:  # query or chart request
            # 3. SQL 생성
            sql_query = await self.generate_sql(user_message, file_metadata, conversation_history)
            
            if not sql_query:
                return "죄송합니다. 질문을 이해하지 못했습니다. 다시 질문해주시겠어요?", None, None, None
            
            # 4. SQL 실행
            try:
                parquet_path = file_metadata.parquet_path
                query_result = DuckDBService.execute_query(parquet_path, sql_query)
            except Exception as e:
                return f"쿼리 실행 중 오류가 발생했습니다: {str(e)}", sql_query, None, None
            
            # 5. 응답 생성
            response, chart_data = await self.generate_response(user_message, file_metadata, sql_query, query_result, conversation_history)
            
            return response, sql_query, None, chart_data
    
    async def get_cached_suggestions(self, file_metadata: FileMetadata) -> List[str]:
        """캐시된 추천 질문 빠르게 가져오기 (GPT 호출 없음)"""
        try:
            from app.utils.database import get_collection
            import random
            
            collection = get_collection("suggested_questions")
            
            stored = await collection.find_one({"file_id": file_metadata.file_id})
            if stored and "questions" in stored:
                questions = stored["questions"]
                if len(questions) >= 4:
                    return random.sample(questions, 4)
                return questions
            
            # 캐시에 없으면 기본 질문 반환
            return [
                f"{file_metadata.columns[0].name}별 데이터를 분석해주세요",
                "데이터의 주요 통계를 보여주세요",
                "가장 많은 값과 적은 값을 찾아주세요",
                "시간대별 추세를 분석해주세요"
            ]
        except:
            return []
    
    async def generate_suggested_questions(self, file_metadata: FileMetadata, force_new: bool = False) -> List[str]:
        """추천 질문 생성 또는 저장된 질문 반환
        
        Args:
            file_metadata: 파일 메타데이터
            force_new: True이면 기존 질문 무시하고 새로 생성
        """
        from app.utils.database import get_collection
        import random
        
        start_time = log_event("agent", "generate_suggested_questions_start", force_new=force_new)
        
        try:
            collection = get_collection("suggested_questions")
            
            # 기존 저장된 질문 조회
            if not force_new:
                stored = await collection.find_one({"file_id": file_metadata.file_id})
                if stored and stored.get("questions"):
                    questions = stored["questions"]
                    # 4개 이상이면 랜덤으로 4개 선택
                    if len(questions) >= 4:
                        selected = random.sample(questions, 4)
                        log_event("agent", "generate_suggested_questions_cached", start_time=start_time, count=len(questions))
                        return selected
                    # 4개 미만이면 전체 반환
                    log_event("agent", "generate_suggested_questions_cached", start_time=start_time, count=len(questions))
                    return questions
            
            # 새로운 질문 생성
            columns_info = "\n".join([
                f"- {col.name} ({col.type.value})"
                for col in file_metadata.columns
            ])
            
            prompt = f"""다음 데이터에 대해 사용자가 물어볼 만한 유용한 질문 4개를 생성해주세요.

파일명: {file_metadata.filename}
행 수: {file_metadata.row_count:,}
컬럼 정보:
{columns_info}

요구사항:
1. **실행 가능성**: 각 질문은 SQL로 즉시 실행 가능해야 함
2. **구체성**: 파일명과 컬럼명을 직접 활용한 구체적 질문
   - 나쁜 예: "데이터를 요약해주세요", "어떤 의미로 질문하신 걸까요?"
   - 좋은 예: "월별 평균 온도 추이를 보여주세요", "가장 높은 풍속이 기록된 날짜는?"
3. **다양성**: 집계(평균, 합계), 필터링(최대, 최소), 그룹화(시간별, 카테고리별), 비교 등 다양한 분석 유형 포함
4. **실용성**: 사용자가 실제로 궁금해할 만한 인사이트 제공
5. 한국어로 작성, JSON 배열 형식: ["질문1", "질문2", "질문3", "질문4"]
6. **절대 금지**: "어떤 의미로...", "다음과 같은 질문을...", "...해보시는 건 어떨까요?" 같은 메타 질문

예시:
- "2023년 평균 기온이 가장 높았던 달은?"
- "풍속이 10m/s 이상인 날짜는 총 며칠인가요?"
- "월별 강수량 합계를 비교해주세요"
"""
            
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": """당신은 데이터 분석 전문가입니다. 데이터의 특성을 파악하여 실행 가능한 구체적 분석 질문을 생성합니다.

절대 생성하지 말아야 할 질문 유형:
- "어떤 의미로 질문하신 걸까요?"
- "다음과 같은 질문을 해보시는 건 어떨까요?"
- "이 데이터에는 어떤 정보가 있나요?"
- "데이터를 요약해주세요"

반드시 생성해야 할 질문 유형:
- 특정 컬럼의 집계값 (평균, 합계, 최대, 최소)
- 시간/카테고리별 그룹 분석
- 조건 필터링 및 비교
- 추세 및 패턴 분석"""},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8
            )
            
            content = response.choices[0].message.content
            
            # JSON 추출 시도
            import json
            new_questions = []
            try:
                questions = json.loads(content)
                if isinstance(questions, list) and len(questions) > 0:
                    new_questions = questions[:4]
            except:
                # JSON 파싱 실패 시 기본 질문
                log_event("agent", "generate_suggested_questions_parse_failed", start_time=start_time)
                new_questions = [
                    f"이 데이터의 주요 특성을 분석해주세요",
                    f"{file_metadata.columns[0].name}별로 데이터를 분류해주세요",
                    f"가장 높은 값과 낮은 값을 찾아주세요",
                    f"데이터의 평균과 합계를 보여주세요"
                ]
            
            # 기존 질문에 추가
            stored = await collection.find_one({"file_id": file_metadata.file_id})
            if stored:
                existing_questions = stored.get("questions", [])
                # 중복 제거 후 추가
                for q in new_questions:
                    if q not in existing_questions:
                        existing_questions.append(q)
                
                from datetime import datetime
                await collection.update_one(
                    {"file_id": file_metadata.file_id},
                    {"$set": {"questions": existing_questions, "updated_at": datetime.utcnow()}}
                )
                
                # 4개 이상이면 랜덤으로 4개 선택
                if len(existing_questions) >= 4:
                    selected = random.sample(existing_questions, 4)
                    log_event("agent", "generate_suggested_questions_complete", start_time=start_time, total=len(existing_questions))
                    return selected
                
                log_event("agent", "generate_suggested_questions_complete", start_time=start_time, total=len(existing_questions))
                return existing_questions
            else:
                # 새로 저장
                from datetime import datetime
                await collection.insert_one({
                    "file_id": file_metadata.file_id,
                    "questions": new_questions,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                })
                
                log_event("agent", "generate_suggested_questions_complete", start_time=start_time, total=len(new_questions))
                return new_questions
            
        except Exception as e:
            log_event("agent", "generate_suggested_questions_error", start_time=start_time, error=str(e))
            return [
                "이 데이터에는 어떤 정보가 있나요?",
                "전체 데이터를 요약해주세요",
                "주요 특징을 분석해주세요",
                "데이터의 패턴을 찾아주세요"
            ]
    
    @staticmethod
    def generate_recommended_prompts(metadata: FileMetadata) -> List[str]:
        """파일명과 컬럼명 기반 AI 쿼리 추천 프롬프트 생성"""
        prompts = []
        
        col_names = [col.name for col in metadata.columns[:5]]  # 상위 5개 컬럼만 사용
        
        # 1. 전체 데이터 조회
        prompts.append(f"{metadata.filename}의 전체 데이터를 보여줘")
        
        # 2. 특정 컬럼 조회
        if len(col_names) >= 1:
            prompts.append(f'"{col_names[0]}" 컬럼의 고유 값들을 알려줘')
        
        # 3. 집계 쿼리
        numeric_cols = [col.name for col in metadata.columns if col.type in ("integer", "float")]
        if numeric_cols:
            prompts.append(f'"{numeric_cols[0]}"의 평균, 최대, 최소값을 알려줘')
        
        # 4. 그룹별 집계
        if len(col_names) >= 2:
            prompts.append(f'"{col_names[0]}"별 데이터 개수를 알려줘')
        
        # 5. 날짜 기반 쿼리
        if metadata.date_column:
            prompts.append(f'최근 10개 데이터를 "{metadata.date_column}" 기준으로 보여줘')
        
        # 6. 조건 필터링
        if len(col_names) >= 1:
            sample = metadata.columns[0].sample_values[0] if metadata.columns[0].sample_values else "특정값"
            prompts.append(f'"{col_names[0]}"이(가) {sample}인 데이터만 조회해줘')
        
        # 7. 다중 컬럼 조합
        if len(col_names) >= 3:
            prompts.append(f'"{col_names[0]}", "{col_names[1]}", "{col_names[2]}" 컬럼만 보여줘')
        
        # 8. NULL 체크
        if len(col_names) >= 1:
            prompts.append(f'"{col_names[0]}"이(가) 비어있는 데이터를 찾아줘')
        
        return prompts[:5]  # 상위 5개만 반환
