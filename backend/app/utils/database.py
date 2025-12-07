from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
import os
from app.utils.logger import log_event

# MongoDB 클라이언트
mongodb_client: AsyncIOMotorClient = None
database = None


async def connect_to_mongo():
    """MongoDB에 연결"""
    global mongodb_client, database
    
    start_time = log_event("database", "connect_start")
    
    try:
        mongodb_url = os.getenv("MONGODB_URL", "mongodb://admin:hypersignal2025@localhost:27891/")
        db_name = os.getenv("MONGODB_DB", "hypersignal")
        
        mongodb_client = AsyncIOMotorClient(mongodb_url)
        
        # 연결 테스트
        await mongodb_client.admin.command('ping')
        
        database = mongodb_client[db_name]
        
        log_event("database", "connect_complete", start_time=start_time)
        print(f"MongoDB에 연결되었습니다: {db_name}")
        
    except ConnectionFailure as e:
        log_event("database", "connect_error", start_time=start_time, error=str(e))
        print(f"MongoDB 연결 실패: {e}")
        raise


async def close_mongo_connection():
    """MongoDB 연결 종료"""
    global mongodb_client
    
    start_time = log_event("database", "disconnect_start")
    
    if mongodb_client:
        mongodb_client.close()
        log_event("database", "disconnect_complete", start_time=start_time)
        print("MongoDB 연결이 종료되었습니다.")


def get_database():
    """데이터베이스 인스턴스 반환"""
    return database


def get_collection(collection_name: str):
    """컬렉션 반환"""
    if database is None:
        raise Exception("데이터베이스가 연결되지 않았습니다.")
    return database[collection_name]
