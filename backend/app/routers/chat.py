from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime
import uuid
import json
import asyncio
import logging
from typing import List, Optional

from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    ChatMessage,
    ChatHistory,
    SuggestedQuestionsRequest,
    SuggestedQuestionsResponse
)
from app.services.file_service import FileService
from app.services.agent_service import DataAgent
from app.utils.database import get_collection
from app.utils.logger import log_event

logger = logging.getLogger(__name__)

router = APIRouter()

# Lazy initialization - DataAgent는 필요할 때만 초기화
_agent = None

def get_agent():
    global _agent
    if _agent is None:
        _agent = DataAgent()
    return _agent


@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest):
    """채팅 메시지 전송"""
    start_time = log_event("api", "send_message_start", file_id=request.file_id)
    
    try:
        # 파일 메타데이터 조회
        file_metadata = await FileService.get_file_by_id(request.file_id)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
        
        # 채팅 ID 확인 또는 생성
        chat_id = request.chat_id or str(uuid.uuid4())
        
        # 기존 채팅 조회 또는 새로 생성
        collection = get_collection("chat_history")
        chat_doc = await collection.find_one({"chat_id": chat_id})
        
        if not chat_doc:
            # 새 채팅 생성
            chat_history = ChatHistory(
                chat_id=chat_id,
                file_id=request.file_id,
                title=request.message[:50],
                messages=[]
            )
        else:
            chat_doc.pop("_id", None)
            chat_history = ChatHistory(**chat_doc)
        
        # 사용자 메시지 추가
        user_message = ChatMessage(
            role="user",
            content=request.message
        )
        chat_history.messages.append(user_message)
        
        # 에이전트 처리
        response_content, sql_query, suggested = await get_agent().process_query(
            request.message,
            file_metadata
        )
        
        # AI 응답 메시지 생성
        ai_message = ChatMessage(
            role="assistant",
            content=response_content,
            sql_query=sql_query
        )
        chat_history.messages.append(ai_message)
        
        # 채팅 히스토리 저장
        chat_history.updated_at = datetime.utcnow()
        
        await collection.replace_one(
            {"chat_id": chat_id},
            chat_history.model_dump(),
            upsert=True
        )
        
        log_event("api", "send_message_complete", start_time=start_time, chat_id=chat_id)
        
        return ChatResponse(
            chat_id=chat_id,
            message=ai_message,
            suggested_questions=suggested
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_event("api", "send_message_error", start_time=start_time, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/message/stream")
async def send_message_stream(request: ChatRequest):
    """채팅 메시지 전송 (SSE)"""
    
    async def event_generator():
        start_time = datetime.now()
        
        try:
            # 파일 메타데이터 조회
            file_metadata = await FileService.get_file_by_id(request.file_id)
            if not file_metadata:
                yield f"data: {json.dumps({'type': 'error', 'message': '파일을 찾을 수 없습니다.'})}\n\n"
                return
            
            # 채팅 ID 확인 또는 생성
            chat_id = request.chat_id or str(uuid.uuid4())
            
            # 기존 채팅 조회 또는 새로 생성
            collection = get_collection("chat_history")
            chat_doc = await collection.find_one({"chat_id": chat_id})
            
            if not chat_doc:
                chat_history = ChatHistory(
                    chat_id=chat_id,
                    file_id=request.file_id,
                    title=request.message[:50],
                    messages=[]
                )
            else:
                chat_doc.pop("_id", None)
                chat_history = ChatHistory(**chat_doc)
            
            # 사용자 메시지 추가
            user_message = ChatMessage(
                role="user",
                content=request.message
            )
            
            # 대화 히스토리 준비 (AI에게 전달용)
            conversation_history = [
                {"role": msg.role, "content": msg.content}
                for msg in chat_history.messages
            ]
            
            chat_history.messages.append(user_message)
            
            agent = get_agent()
            
            # 의도 파악 중
            yield f"data: {json.dumps({'type': 'status', 'message': '질문 분석 중...'})}\n\n"
            await asyncio.sleep(0)  # yield 처리를 위한 비동기 포인트
            
            intent = await agent.analyze_intent(request.message, file_metadata)
            logger.info(f"Intent analyzed: {intent} for message: {request.message}")
            
            # ===== 의도에 따라 처리하고 바로 response 전송 =====
            if intent == "irrelevant":
                # 데이터와 무관한 질문
                response_content = "안녕하세요! 데이터 분석을 도와드립니다. 선택하신 파일에 대해 질문해주세요."
                sql_query = None
                suggested = []
                chart_data = None
                
            elif intent == "meaningless":
                # 무의미한 입력 - 추천 질문만 제공
                yield f"data: {json.dumps({'type': 'status', 'message': '추천 질문 준비 중...'})}\n\n"
                await asyncio.sleep(0)
                
                suggested = await agent.get_cached_suggestions(file_metadata)
                response_content = f"""질문을 좀 더 구체적으로 해주시겠어요?\n\n다음과 같은 질문을 추천드립니다:\n{chr(10).join(f"{i+1}. {q}" for i, q in enumerate(suggested))}"""
                sql_query = None
                chart_data = None
                
            elif intent == "question_mark":
                # ? 만 입력 - 추천 질문 제공
                yield f"data: {json.dumps({'type': 'status', 'message': '질문 처리 중...'})}\n\n"
                await asyncio.sleep(0)
                
                response_content, sql_query, suggested, chart_data = await agent.process_query(
                    request.message, file_metadata, conversation_history
                )
                
            elif intent == "explanation":
                # 데이터 설명 요청
                yield f"data: {json.dumps({'type': 'status', 'message': '데이터 설명 준비 중...'})}\n\n"
                await asyncio.sleep(0)
                
                response_content = await agent.handle_explanation(file_metadata, request.message)
                sql_query = None
                suggested = []
                chart_data = None
                
            elif intent == "metadata":
                # 메타데이터 조회
                yield f"data: {json.dumps({'type': 'status', 'message': '메타데이터 조회 중...'})}\n\n"
                await asyncio.sleep(0)
                
                response_content = await agent.handle_metadata(file_metadata)
                sql_query = None
                suggested = []
                chart_data = None
                
            else:  # query intent - 실제 데이터 쿼리
                # 단계 1: SQL 생성
                yield f"data: {json.dumps({'type': 'status', 'message': '데이터를 찾고 있습니다...'})}\n\n"
                await asyncio.sleep(0)
                
                try:
                    sql_query, ai_response = await agent._generate_sql(
                        request.message, file_metadata, conversation_history
                    )
                    
                    if not sql_query:
                        response_content = ai_response
                        chart_data = None
                    else:
                        # 단계 2: SQL 실행
                        yield f"data: {json.dumps({'type': 'status', 'message': '결과를 분석하고 있습니다...'})}\n\n"
                        await asyncio.sleep(0)
                        
                        query_result = await agent._execute_sql(sql_query, file_metadata)
                        
                        if query_result is None:
                            response_content = "데이터 조회 중 오류가 발생했습니다."
                            chart_data = None
                        else:
                            # 단계 3: 결과 처리
                            yield f"data: {json.dumps({'type': 'status', 'message': '답변을 준비하고 있습니다...'})}\n\n"
                            await asyncio.sleep(0)
                            
                            response_content, chart_data = await agent._process_result(
                                query_result, ai_response, request.message
                            )
                    
                except Exception as e:
                    logger.error(f"Query processing error: {e}")
                    response_content = f"죄송합니다. 데이터 처리 중 오류가 발생했습니다: {str(e)}"
                    sql_query = None
                    chart_data = None
                
                # 추천 질문 준비
                suggested = await agent.get_cached_suggestions(file_metadata)
            
            # AI 응답 메시지 생성
            ai_message = ChatMessage(
                role="assistant",
                content=response_content,
                sql_query=sql_query,
                chart_data=chart_data
            )
            chat_history.messages.append(ai_message)
            
            # 채팅 히스토리 저장
            chat_history.updated_at = datetime.utcnow()
            
            await collection.replace_one(
                {"chat_id": chat_id},
                chat_history.model_dump(),
                upsert=True
            )
            
            elapsed = (datetime.now() - start_time).total_seconds()
            
            # 최종 결과 전송
            result = {
                'type': 'complete',
                'chat_id': chat_id,
                'message': {
                    'role': ai_message.role,
                    'content': ai_message.content,
                    'timestamp': ai_message.timestamp.isoformat(),
                    'sql_query': ai_message.sql_query,
                    'chart_data': ai_message.chart_data
                },
                'suggested_questions': suggested,
                'elapsed': round(elapsed, 2)
            }
            yield f"data: {json.dumps(result)}\n\n"
            
        except Exception as e:
            elapsed = (datetime.now() - start_time).total_seconds()
            yield f"data: {json.dumps({'type': 'error', 'message': str(e), 'elapsed': round(elapsed, 2)})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/suggestions", response_model=SuggestedQuestionsResponse)
async def get_suggestions(request: SuggestedQuestionsRequest):
    """추천 질문 생성"""
    start_time = log_event("api", "get_suggestions_start", file_id=request.file_id, force_new=request.force_new)
    
    try:
        file_metadata = await FileService.get_file_by_id(request.file_id)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
        
        questions = await get_agent().generate_suggested_questions(file_metadata, force_new=request.force_new)
        
        log_event("api", "get_suggestions_complete", start_time=start_time)
        
        return SuggestedQuestionsResponse(questions=questions)
        
    except HTTPException:
        raise
    except Exception as e:
        log_event("api", "get_suggestions_error", start_time=start_time, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{chat_id}")
async def get_chat_history(chat_id: str):
    """채팅 히스토리 조회"""
    start_time = log_event("api", "get_chat_history_start", chat_id=chat_id)
    
    try:
        collection = get_collection("chat_history")
        chat_doc = await collection.find_one({"chat_id": chat_id})
        
        if not chat_doc:
            raise HTTPException(status_code=404, detail="채팅을 찾을 수 없습니다.")
        
        chat_doc.pop("_id", None)
        log_event("api", "get_chat_history_complete", start_time=start_time)
        
        return ChatHistory(**chat_doc)
        
    except HTTPException:
        raise
    except Exception as e:
        log_event("api", "get_chat_history_error", start_time=start_time, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/file/{file_id}")
async def get_chat_list_by_file(file_id: str):
    """파일별 채팅 목록 조회"""
    start_time = log_event("api", "get_chat_list_start", file_id=file_id)
    
    try:
        collection = get_collection("chat_history")
        cursor = collection.find({"file_id": file_id}).sort("updated_at", -1)
        
        chats = []
        async for doc in cursor:
            doc.pop("_id", None)
            chats.append(ChatHistory(**doc))
        
        log_event("api", "get_chat_list_complete", start_time=start_time, count=len(chats))
        
        return {"chats": chats}
        
    except Exception as e:
        log_event("api", "get_chat_list_error", start_time=start_time, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def get_all_chats():
    """전체 채팅 목록 조회"""
    start_time = log_event("api", "get_all_chats_start")
    
    try:
        collection = get_collection("chat_history")
        cursor = collection.find().sort("updated_at", -1)
        
        chats = []
        async for doc in cursor:
            doc.pop("_id", None)
            # 메시지 개수만 포함
            chat_summary = {
                "chat_id": doc["chat_id"],
                "file_id": doc["file_id"],
                "title": doc["title"],
                "message_count": len(doc.get("messages", [])),
                "created_at": doc["created_at"],
                "updated_at": doc["updated_at"]
            }
            chats.append(chat_summary)
        
        log_event("api", "get_all_chats_complete", start_time=start_time, count=len(chats))
        
        return {"chats": chats}
        
    except Exception as e:
        log_event("api", "get_all_chats_error", start_time=start_time, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/history/{chat_id}")
async def delete_chat(chat_id: str):
    """대화 삭제"""
    start_time = log_event("api", "delete_chat_start", chat_id=chat_id)
    
    try:
        collection = get_collection("chat_history")
        result = await collection.delete_one({"chat_id": chat_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="대화를 찾을 수 없습니다.")
        
        log_event("api", "delete_chat_complete", start_time=start_time)
        return {"message": "대화가 삭제되었습니다."}
        
    except HTTPException:
        raise
    except Exception as e:
        log_event("api", "delete_chat_error", start_time=start_time, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
