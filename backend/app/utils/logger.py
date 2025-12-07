import logging
import os
from datetime import datetime
from typing import Optional
import json

# 로그 디렉터리 생성
LOG_DIR = os.getenv("LOG_DIR", "./logs")
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

# 로그 파일 경로
log_filename = os.path.join(LOG_DIR, f"hypersignal_{datetime.now().strftime('%Y%m%d')}.log")


def setup_logger():
    """로거 설정"""
    logger = logging.getLogger("hypersignal")
    logger.setLevel(logging.INFO)
    
    # 파일 핸들러
    file_handler = logging.FileHandler(log_filename, encoding='utf-8')
    file_handler.setLevel(logging.INFO)
    
    # 콘솔 핸들러
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    # 포맷 설정
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger


logger = setup_logger()


def log_event(
    event_type: str,
    event_name: str,
    start_time: Optional[datetime] = None,
    error: Optional[str] = None,
    **kwargs
):
    """
    이벤트 로그 기록
    
    Args:
        event_type: 이벤트 타입 (database, api, agent, file, etc.)
        event_name: 이벤트 이름
        start_time: 시작 시간 (종료 시 소요 시간 계산용)
        error: 에러 메시지
        **kwargs: 추가 정보
    """
    current_time = datetime.utcnow()
    
    log_data = {
        "event_type": event_type,
        "event_name": event_name,
        "timestamp": current_time.isoformat(),
    }
    
    # 소요 시간 계산
    if start_time:
        elapsed_time = (current_time - start_time).total_seconds()
        log_data["elapsed_time"] = f"{elapsed_time:.2f}s"
    
    # 에러 정보
    if error:
        log_data["error"] = error
        logger.error(json.dumps(log_data, ensure_ascii=False))
    else:
        # 추가 정보
        log_data.update(kwargs)
        logger.info(json.dumps(log_data, ensure_ascii=False))
    
    return current_time
