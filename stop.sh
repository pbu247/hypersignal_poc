#!/bin/bash

echo "[STOP] HyperSignal 종료 중..."

# 현재 디렉터리 저장
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$PROJECT_DIR/.pids"

# PID 파일에서 프로세스 종료
if [ -f "$PID_FILE" ]; then
    echo "[INFO] 등록된 프로세스 종료 중..."
    
    while IFS=: read -r name pid; do
        if [ ! -z "$pid" ]; then
            if ps -p $pid > /dev/null 2>&1; then
                echo "  - $name (PID: $pid) 종료 중..."
                kill $pid 2>/dev/null
                
                # 프로세스가 종료될 때까지 대기
                count=0
                while ps -p $pid > /dev/null 2>&1 && [ $count -lt 10 ]; do
                    sleep 0.5
                    count=$((count + 1))
                done
                
                # 강제 종료가 필요한 경우
                if ps -p $pid > /dev/null 2>&1; then
                    echo "  - 강제 종료: $name (PID: $pid)"
                    kill -9 $pid 2>/dev/null
                fi
            else
                echo "  - $name (PID: $pid)는 이미 종료됨"
            fi
        fi
    done < "$PID_FILE"
    
    rm -f "$PID_FILE"
fi

# 남아있는 관련 프로세스 찾기 및 종료
echo "[INFO] 남은 프로세스 검사 중..."

# 포트 기반으로 프로세스 종료 (가장 확실한 방법)
PORT_8000=$(lsof -ti:8000 2>/dev/null)
if [ ! -z "$PORT_8000" ]; then
    echo "  - 포트 8000 사용 프로세스 종료 (Backend)"
    echo "$PORT_8000" | xargs kill -9 2>/dev/null
fi

PORT_5173=$(lsof -ti:5173 2>/dev/null)
if [ ! -z "$PORT_5173" ]; then
    echo "  - 포트 5173 사용 프로세스 종료 (Frontend)"
    echo "$PORT_5173" | xargs kill -9 2>/dev/null
fi

# Backend 프로세스 (uvicorn)
BACKEND_PIDS=$(ps aux | grep "uvicorn app.main:app" | grep -v grep | awk '{print $2}')
if [ ! -z "$BACKEND_PIDS" ]; then
    echo "  - Backend 프로세스 발견 및 종료"
    echo "$BACKEND_PIDS" | xargs kill -9 2>/dev/null
fi

# Frontend 프로세스 (vite)
FRONTEND_PIDS=$(ps aux | grep "vite" | grep -v grep | awk '{print $2}')
if [ ! -z "$FRONTEND_PIDS" ]; then
    echo "  - Frontend 프로세스 발견 및 종료"
    echo "$FRONTEND_PIDS" | xargs kill -9 2>/dev/null
fi

# Node 프로세스 중 프로젝트 관련
NODE_PIDS=$(ps aux | grep "node.*hypersignal" | grep -v grep | awk '{print $2}')
if [ ! -z "$NODE_PIDS" ]; then
    echo "  - Node 프로세스 발견 및 종료"
    echo "$NODE_PIDS" | xargs kill -9 2>/dev/null
fi

# Docker Compose 종료 (볼륨 유지)
echo "[INFO] Docker 컨테이너 종료 중..."
cd "$PROJECT_DIR"
docker-compose down
if [ $? -eq 0 ]; then
    echo "[OK] Docker 컨테이너 종료 완료 (볼륨은 유지됨)"
    echo "[INFO] 볼륨을 삭제하려면 ./remove.sh를 실행하세요"
else
    echo "[WARN] Docker 컨테이너 종료 실패 (이미 종료되었을 수 있음)"
fi

echo ""
echo "[SUCCESS] HyperSignal이 모두 종료되었습니다."
echo ""

# 최종 프로세스 확인
REMAINING=$(ps aux | grep -E "uvicorn|vite.*hypersignal|node.*hypersignal" | grep -v grep)
if [ ! -z "$REMAINING" ]; then
    echo "[WARN] 일부 프로세스가 여전히 실행 중입니다:"
    echo "$REMAINING"
    echo ""
    echo "수동으로 종료하려면:"
    echo "  ps aux | grep -E 'uvicorn|vite|node' | grep hypersignal"
    echo "  kill -9 <PID>"
else
    echo "[OK] 모든 프로세스가 정상적으로 종료되었습니다."
fi
