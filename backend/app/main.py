from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

from app.utils.database import connect_to_mongo, close_mongo_connection
from app.utils.logger import setup_logger, log_event
from app.routers import files, chat, query

load_dotenv()

logger = setup_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    log_event("application", "startup_start")
    await connect_to_mongo()
    log_event("application", "startup_complete")
    yield
    # Shutdown
    log_event("application", "shutdown_start")
    await close_mongo_connection()
    log_event("application", "shutdown_complete")


app = FastAPI(title="HyperSignal", version="1.0.0", lifespan=lifespan)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(query.router, prefix="/api/query", tags=["query"])


@app.get("/")
async def root():
    return {"message": "HyperSignal API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
