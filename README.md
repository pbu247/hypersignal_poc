# HyperSignal - AI 기반 데이터 탐색 플랫폼

[![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.2.0-61DAFB.svg?style=flat&logo=React&logoColor=black)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg?style=flat&logo=Python&logoColor=white)](https://www.python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6.svg?style=flat&logo=TypeScript&logoColor=white)](https://www.typescriptlang.org)

> **자연어로 데이터를 탐색하고, AI와 대화하며 인사이트를 발견하세요.**

HyperSignal은 GPT-4 기반의 대화형 데이터 분석 도구로, 복잡한 SQL 쿼리 없이도 자연어만으로 데이터를 탐색할 수 있습니다.

## ✨ 주요 기능

### 🤖 AI 기반 대화형 분석
- **자연어 질의**: "상위 10개 판매 제품은?" 같은 일상 언어로 질문
- **스마트 추천**: AI가 데이터를 분석하여 유용한 질문 자동 생성
- **실시간 응답**: 0.00초 단위로 처리 상태 표시
- **컨텍스트 이해**: 이전 대화를 기억하는 연속적인 대화 지원

### 📊 강력한 데이터 처리
- **다양한 포맷 지원**: CSV, Excel 파일 자동 변환
- **인코딩 자동 감지**: 한글 데이터도 완벽하게 처리
- **Parquet 최적화**: 빠른 조회를 위한 자동 변환 및 파티셔닝
- **DuckDB 엔진**: 대용량 데이터도 빠르게 분석

### 📈 지능형 시각화
- **자동 차트 선택**: 데이터 특성에 맞는 최적의 차트 타입 자동 결정
- **5가지 차트 타입**: 바, 라인, 영역, 파이, 콤보 차트
- **인터랙티브**: 호버, 확대/축소, 데이터 포인트 상세 보기
- **한국어 최적화**: 숫자 천 단위 구분, 긴 라벨 자동 회전

### 💬 사용자 친화적 인터페이스
- **컬럼명 자동완성**: Tab 키로 빠른 입력
- **클릭 가능한 추천 질문**: 복사/붙여넣기 없이 바로 실행
- **데이터 미리보기**: 30/50/100/150/200개 행 선택 조회
- **SQL 쿼리 확인**: 실행된 쿼리를 고급스러운 코드 블록으로 표시
- **대화 기록 관리**: 파일별 여러 대화 생성 및 관리

## 🚀 빠른 시작

### 사전 요구사항
- **Docker Desktop** (MongoDB 실행용)
- **터미널** (macOS Terminal 또는 iTerm2)

### 설치 및 실행

```bash
# 1. 프로젝트 클론
git clone <repository-url>
cd hypersignal_poc

# 2. 환경 변수 확인 (OpenAI API 키)
cat backend/.env

# 3. 애플리케이션 시작
./start.sh

# 4. 브라우저에서 접속
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000/docs
```

**더 자세한 가이드는 [QUICKSTART.md](QUICKSTART.md)를 참고하세요.**

## 📖 사용 방법

### 1️⃣ 파일 업로드
오른쪽 패널에서 **"파일 업로드"** → CSV/Excel 파일 선택 → 자동 변환 대기

### 2️⃣ 데이터 탐색
```
💬 "2025년 1월 매출이 가장 높은 상품은?"
💬 "지역별 판매량을 비교해주세요"
💬 "월별 추세를 차트로 보여주세요"
```

### 3️⃣ 결과 확인
- 📝 AI의 자연어 답변
- 📊 자동 생성된 시각화 차트
- 🔍 실행된 SQL 쿼리 (클릭하여 확인)

## 🏗️ 기술 스택

### Backend
- **FastAPI** 0.109.0 - 고성능 비동기 API 프레임워크
- **MongoDB** - 메타데이터 저장소
- **DuckDB** 0.10.0 - 초고속 분석형 데이터베이스
- **OpenAI GPT-4** - 자연어 처리 및 SQL 생성
- **Pandas** 2.2.0 - 데이터 처리
- **PyArrow** 15.0.0 - Parquet 파일 처리

### Frontend
- **React** 19.2.0 - UI 프레임워크
- **TypeScript** 5.6 - 타입 안정성
- **Vite** 7.2.6 - 빠른 개발 서버
- **Tailwind CSS** 3.4 - 유틸리티 기반 스타일링
- **Chart.js** 4.4 - 차트 시각화
- **React Markdown** - 마크다운 렌더링

## 📁 프로젝트 구조

```
hypersignal_poc/
├── backend/                 # FastAPI 백엔드
│   ├── app/
│   │   ├── main.py         # FastAPI 애플리케이션
│   │   ├── routers/        # API 라우터
│   │   ├── services/       # 비즈니스 로직
│   │   ├── models/         # 데이터 모델
│   │   └── utils/          # 유틸리티
│   ├── requirements.txt    # Python 패키지
│   ├── .env               # 환경 변수 (포함됨)
│   └── uploads/           # 업로드된 파일
│
├── frontend/               # React 프론트엔드
│   ├── src/
│   │   ├── components/    # React 컴포넌트
│   │   ├── services/      # API 서비스
│   │   ├── types/         # TypeScript 타입
│   │   └── config/        # 설정
│   └── package.json       # Node 패키지
│
├── docker-compose.yml     # Docker 구성
├── start.sh              # 시작 스크립트
├── stop.sh               # 종료 스크립트
├── QUICKSTART.md         # 빠른 시작 가이드
└── Specification.md      # 상세 기능 명세
```

## 🔧 개발 환경

### 환경 변수 설정
`backend/.env` 파일:
```env
MONGODB_URL=mongodb://admin:hypersignal2025@localhost:27891/
MONGODB_DB=hypersignal
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
UPLOAD_DIR=./uploads
LOG_DIR=./logs
```

### 개발 서버 실행
```bash
# Backend만 실행
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend만 실행
cd frontend
npm run dev
```

### 종료
```bash
./stop.sh
```

## 📊 주요 기능 상세

### 자동 차트 타입 선택
AI가 데이터 특성을 분석하여 최적의 차트를 자동 선택:
- **파이 차트**: 10개 이하 카테고리 + 비율/분포 분석
- **영역 차트**: 시계열 + 단일 데이터셋
- **라인 차트**: 시계열 + 다중 데이터셋  
- **콤보 차트**: 스케일 차이 10배 이상
- **바 차트**: 카테고리별 비교 (기본값)

### 파일 처리 파이프라인
1. **업로드**: CSV/Excel 파일
2. **인코딩 감지**: chardet으로 자동 감지
3. **변환**: Parquet 형식으로 최적화
4. **파티셔닝**: 날짜 컬럼 존재 시 자동 파티셔닝
5. **메타데이터 저장**: MongoDB에 컬럼 정보 저장
6. **버전 관리**: 동일 파일명 재업로드 시 버전 증가

### 대화 기록 관리
- 파일별 독립적인 대화 생성
- 대화 자동 제목 생성
- 이전 대화 내용 기반 컨텍스트 유지
- MongoDB에 영구 저장

## 🐛 문제 해결

### 포트 충돌
```bash
lsof -i :5173  # Frontend
lsof -i :8000  # Backend
lsof -i :27891 # MongoDB
kill -9 <PID>
```

### Docker 이슈
```bash
docker-compose down
docker-compose up -d
docker ps
```

### 로그 확인
```bash
tail -f backend/logs/app.log
docker-compose logs -f
```

## 📝 API 문서

서버 실행 후 접속:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🤝 기여

내부 프로젝트로 외부 기여는 받지 않습니다.

## 📄 라이선스

MIT License - 내부 사용 전용

## 📧 문의

프로젝트 관련 문의사항은 개발팀에 연락하세요.

---

**Made with ❤️ by HyperSignal Team**
