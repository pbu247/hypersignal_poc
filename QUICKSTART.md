# HyperSignal Quick Start Guide

이 가이드는 HyperSignal을 처음 사용하는 사용자를 위한 빠른 시작 가이드입니다.

## 📋 사전 준비

### 필수 소프트웨어
- **Docker Desktop**: 컨테이너 실행을 위해 필요합니다
- **터미널**: macOS Terminal 또는 iTerm2

### 시스템 요구사항
- macOS (Apple Silicon 또는 Intel)
- 최소 4GB RAM
- 최소 2GB 여유 디스크 공간

## 🚀 5분 안에 시작하기

### 1단계: 프로젝트 다운로드
```bash
git clone <repository-url>
cd hypersignal_poc
```

### 2단계: 환경 변수 확인
`backend/.env` 파일에 OpenAI API 키가 설정되어 있는지 확인합니다.
```bash
cat backend/.env
```

내용 예시:
```
MONGODB_URL=mongodb://admin:hypersignal2025@localhost:27891/
MONGODB_DB=hypersignal
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
UPLOAD_DIR=./uploads
LOG_DIR=./logs
```

### 3단계: 애플리케이션 시작
```bash
./start.sh
```

시작 스크립트는 자동으로:
- ✅ Docker 컨테이너 실행 (MongoDB)
- ✅ Python 가상환경 생성 및 패키지 설치
- ✅ Backend 서버 시작 (FastAPI)
- ✅ Frontend 개발 서버 시작 (Vite)

### 4단계: 브라우저에서 접속
자동으로 브라우저가 열립니다. 열리지 않는 경우:
- **Frontend**: http://localhost:5173
- **Backend API Docs**: http://localhost:8000/docs

## 📊 첫 번째 데이터 분석

### 1. 파일 업로드
1. 오른쪽 패널 상단의 **"파일 업로드"** 버튼 클릭
2. CSV 또는 Excel 파일 선택
3. 업로드 완료 대기 (자동으로 Parquet 형식으로 변환됨)

### 2. 파일 선택
1. 업로드된 파일 목록에서 분석할 파일 클릭
2. 파일 정보(행 수, 열 수)가 상단에 표시됨
3. **"데이터 구성"** 버튼을 클릭하면 열 정보 확인 가능

### 3. 데이터 탐색
채팅창에서 자연어로 질문합니다:

**기본 질문 예시:**
- "상위 10개 데이터를 보여주세요"
- "전체 데이터를 요약해주세요"
- "데이터의 기본 통계를 보여주세요"

**AI 추천 질문:**
초기 화면에서 AI가 자동으로 생성한 추천 질문을 클릭할 수 있습니다.

### 4. 결과 확인
- 💬 AI가 자연어로 답변
- 📊 시각화 가능한 데이터는 차트로 표시
- 🔍 **"SQL"** 버튼을 클릭하면 실행된 쿼리 확인 가능

## 💡 주요 기능

### 자동완성
- 채팅창에 입력 시 열(컬럼) 이름 자동완성
- **Tab 키**: 자동완성 적용
- **Enter 키**: 질문 전송
- **???**: 모든 열 이름 표시

### 데이터 구성 보기
1. 상단의 **"데이터 구성"** 버튼 클릭
2. **열 구성 탭**: 각 열의 타입과 예시 값 확인
3. **행 구성 탭**: 실제 데이터 미리보기 (30/50/100/150/200개)

### 대화 기록 관리
- 왼쪽 패널에서 대화 기록 확인
- 각 파일별로 여러 대화 생성 가능
- 이전 대화 클릭하여 재개 가능

### 클릭 가능한 추천 질문
- AI 응답에 포함된 질문을 직접 클릭하여 바로 실행
- 복사/붙여넣기 불필요

### 차트 시각화
AI가 데이터 특성에 따라 적절한 차트를 자동 선택:
- **바 차트**: 카테고리별 비교
- **라인 차트**: 시계열 데이터
- **영역 차트**: 단일 시계열 추세
- **파이 차트**: 비율/분포 분석
- **콤보 차트**: 스케일이 다른 복수 데이터

## 🛑 종료하기

```bash
./stop.sh
```

종료 스크립트는 자동으로:
- ✅ Frontend 서버 중지
- ✅ Backend 서버 중지
- ✅ Docker 컨테이너 중지

## 🔧 문제 해결

### 포트가 이미 사용 중인 경우
```bash
# 사용 중인 프로세스 확인
lsof -i :5173  # Frontend
lsof -i :8000  # Backend
lsof -i :27891 # MongoDB

# 프로세스 종료
kill -9 <PID>
```

### MongoDB 연결 오류
```bash
# Docker 컨테이너 상태 확인
docker ps

# 컨테이너 재시작
docker-compose down
docker-compose up -d
```

### 패키지 설치 오류
```bash
# Backend 가상환경 재생성
cd backend
rm -rf venv
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend 패키지 재설치
cd ../frontend
rm -rf node_modules package-lock.json
npm install
```

### 로그 확인
```bash
# Backend 로그
tail -f backend/logs/app.log

# Docker 로그
docker-compose logs -f
```

## 📚 다음 단계

- **README.md**: 프로젝트 전체 개요
- **Specification.md**: 상세 기능 명세
- **Backend API Docs**: http://localhost:8000/docs
- **work_history/**: 개발 이력 및 상세 문서

## 💬 지원

문제가 발생하면 `work_history/` 디렉터리의 문서를 참고하거나 개발팀에 문의하세요.
