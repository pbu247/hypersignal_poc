#!/bin/bash

echo "[START] HyperSignal 시작 중..."

# 현재 디렉터리 저장
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$PROJECT_DIR/.pids"

# 로그 디렉터리 생성
mkdir -p "$PROJECT_DIR/logs"

# 기존 PID 파일 삭제
rm -f "$PID_FILE"

# MongoDB 시작
echo "[INFO] MongoDB 시작 중..."
cd "$PROJECT_DIR"
docker-compose up -d
if [ $? -ne 0 ]; then
    echo "[ERROR] MongoDB 시작 실패"
    exit 1
fi
echo "[OK] MongoDB 시작 완료"

# 잠시 대기 (MongoDB 준비 시간)
sleep 3

# Backend 시작
echo "[INFO] Backend 시작 중..."
cd "$PROJECT_DIR/backend"

# 가상환경 확인
if [ ! -d "venv" ]; then
    echo "[ERROR] 가상환경이 없습니다. 먼저 ./setup.sh를 실행해주세요."
    exit 1
fi

source venv/bin/activate

# FastAPI 서버 시작
cd "$PROJECT_DIR/backend"
# .env 파일 로드
set -a
source .env
set +a
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "$PROJECT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo "backend:$BACKEND_PID" >> "$PID_FILE"
echo "[OK] Backend 시작 완료 (PID: $BACKEND_PID)"

# Frontend 시작
echo "[INFO] Frontend 시작 중..."
cd "$PROJECT_DIR/frontend"

# 패키지 설치 확인
if [ ! -d "node_modules" ]; then
    echo "[ERROR] Frontend 패키지가 없습니다. 먼저 ./setup.sh를 실행해주세요."
    exit 1
fi

# Vite 개발 서버 시작
nohup npm run dev > "$PROJECT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "frontend:$FRONTEND_PID" >> "$PID_FILE"
echo "[OK] Frontend 시작 완료 (PID: $FRONTEND_PID)"

echo ""
echo "[SUCCESS] HyperSignal이 시작되었습니다!"
echo ""
echo "[INFO] 서비스 접속 정보:"
echo "  - Frontend: http://localhost:5173"
echo "  - Backend API: http://localhost:8000"
echo "  - API Docs: http://localhost:8000/docs"
echo "  - MongoDB: localhost:27891"
echo ""
echo "[INFO] 로그 위치:"
echo "  - Backend: $PROJECT_DIR/logs/backend.log"
echo "  - Frontend: $PROJECT_DIR/logs/frontend.log"
echo ""
echo "[INFO] 종료하려면: ./stop.sh"
echo ""
