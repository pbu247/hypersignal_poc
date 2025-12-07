#!/bin/bash

echo "[REMOVE] HyperSignal 완전 삭제 중..."

# 현재 디렉터리 저장
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 먼저 모든 프로세스 종료
echo "[INFO] 실행 중인 프로세스 종료..."
"$PROJECT_DIR/stop.sh"

# 추가 포트 정리 (혹시 남아있을 경우)
echo "[INFO] 포트 추가 정리 중..."
lsof -ti:8000 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null

echo ""
echo "[WARNING] Docker 볼륨을 삭제합니다. 모든 데이터가 영구적으로 삭제됩니다!"
echo "계속하려면 'yes'를 입력하세요:"
read -r response

if [ "$response" != "yes" ]; then
    echo "[CANCELLED] 삭제가 취소되었습니다."
    exit 0
fi

# Docker Compose 볼륨까지 완전 삭제
echo "[INFO] Docker 컨테이너 및 볼륨 삭제 중..."
cd "$PROJECT_DIR"
docker-compose down -v

if [ $? -eq 0 ]; then
    echo "[OK] Docker 컨테이너 및 볼륨 삭제 완료"
else
    echo "[ERROR] Docker 삭제 실패"
    exit 1
fi

# 추가로 고아 볼륨 정리
echo "[INFO] 고아 볼륨 정리 중..."
docker volume prune -f

echo ""
echo "[SUCCESS] HyperSignal이 완전히 삭제되었습니다."
echo ""
echo "재시작하려면:"
echo "  ./start.sh"
