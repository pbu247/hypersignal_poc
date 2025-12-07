# HyperSignal 프로젝트 작업 이력

## 프로젝트 개요
- **프로젝트명**: HyperSignal
- **설명**: 채팅으로 데이터를 조회하고 에이전트와 함께 탐색하는 데이터 활용 AI 도구
- **작업일**: 2025년 12월 6일

## 기술 스택

### Backend
- Python 3.12
- FastAPI
- MongoDB (포트: 27891)
- DuckDB
- LangGraph + OpenAI GPT-4
- Pandas, PyArrow (데이터 처리)

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Axios
- React Markdown
- ECharts (차트 라이브러리)

### Infrastructure
- Docker Compose (MongoDB)
- Node.js 24.x

## 프로젝트 구조

```
hypersignal_poc/
├── docker-compose.yml          # MongoDB 컨테이너 설정
├── start.sh                    # 프로젝트 시작 스크립트
├── stop.sh                     # 프로젝트 종료 스크립트
├── Specification.md            # 프로젝트 명세서
├── backend/
│   ├── .env                    # 환경 변수
│   ├── requirements.txt        # Python 패키지
│   ├── venv/                   # 가상환경
│   └── app/
│       ├── main.py            # FastAPI 메인 앱
│       ├── models/
│       │   └── schemas.py     # Pydantic 모델
│       ├── routers/
│       │   ├── files.py       # 파일 업로드/조회 API
│       │   └── chat.py        # 채팅 API
│       ├── services/
│       │   ├── file_service.py    # 파일 처리 서비스
│       │   ├── duckdb_service.py  # DuckDB 쿼리 서비스
│       │   └── agent_service.py   # AI 에이전트 서비스
│       └── utils/
│           ├── database.py    # MongoDB 연결
│           └── logger.py      # 로깅 유틸리티
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx            # 메인 앱
│       ├── types/index.ts     # TypeScript 타입 정의
│       ├── config/api.ts      # API 설정
│       ├── services/api.ts    # API 클라이언트
│       └── components/
│           ├── Header.tsx
│           ├── ChatHistoryPanel.tsx
│           ├── ChatPanel.tsx
│           └── FileListPanel.tsx
└── work_history/              # 작업 이력
```

## 주요 기능 구현

### 1. 파일 업로드 및 처리
- CSV, Excel, Parquet 파일 업로드 지원
- 자동 인코딩 감지 (chardet)
- Parquet 형식으로 변환 및 저장
- 날짜 컬럼 자동 감지 및 파티셔닝
- UUID 기반 파일 식별
- 동일 파일명 업로드 시 버전 관리
- MongoDB에 메타데이터 저장 (파일 정보, 컬럼 정보, 행 수 등)

### 2. DuckDB 데이터 조회
- In-memory DuckDB 엔진 사용
- Parquet 파일 직접 쿼리
- 파티셔닝된 데이터 지원
- SQL 쿼리 실행 및 결과 반환

### 3. AI 에이전트 (LangGraph)
- GPT-4 기반 데이터 분석 에이전트
- 질문 의도 분석 (meaningless, metadata, query)
- 자동 SQL 쿼리 생성
- 자연어 답변 생성
- 의미 없는 질문 처리 및 재질문
- 추천 질문 4개 자동 생성
- SQL 쿼리 히스토리 저장

### 4. 채팅 시스템
- 실시간 채팅 인터페이스
- 채팅 히스토리 저장 및 불러오기
- 파일별 채팅 세션 관리
- 마크다운 렌더링 지원
- SQL 쿼리 접기/펼치기 기능
- 0.01초 단위 처리 상태 표시

### 5. UI/UX
- 3단 레이아웃 (채팅 히스토리 | 채팅창 | 파일 목록)
- AI 테마의 세련된 디자인 (다크 모드)
- 포인트 컬러 (Primary, Accent)
- 컬럼 정보 팝업 (스크롤 지원)
- 파일 업로드 진행률 표시
- 애니메이션 효과
- 반응형 UI

### 6. 로깅 시스템
- 모든 이벤트 로깅 (API, Database, DuckDB, Agent)
- 시작/종료 시간, 소요 시간 기록
- JSON 형식 로그
- 날짜별 로그 파일 생성
- logs/ 디렉터리 자동 생성

## 환경 설정

### Backend 환경변수 (.env)
```
MONGODB_URL=mongodb://admin:hypersignal2025@localhost:27891/
MONGODB_DB=hypersignal
OPENAI_API_KEY=your_openai_api_key_here
UPLOAD_DIR=./uploads
LOG_DIR=./logs
```

### 실행 방법
```bash
# 프로젝트 시작
./start.sh

# 프로젝트 종료
./stop.sh
```

### 서비스 접속 정보
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- MongoDB: localhost:27891

## 미구현 기능
- ECharts 차트 컴포넌트 (기본 구조는 완성, 실제 차트 생성 로직 추가 필요)
- 컬럼 자동완성 기능 (입력창에서 Tab 키로 자동완성)

## 작업 방식

### 코드 구조
- 모듈화된 서비스 구조
- Dependency Injection 패턴
- 타입 안정성 (TypeScript, Pydantic)
- 에러 처리 및 로깅

### 데이터 흐름
1. 파일 업로드 → 인코딩 감지 → Parquet 변환 → 메타데이터 저장
2. 사용자 질문 → 의도 분석 → SQL 생성 → DuckDB 실행 → 답변 생성
3. 모든 이벤트 로깅 (시작/종료/소요시간)

### 시간 처리
- 모든 시간은 UTC로 저장
- 화면 표시 시 KST로 변환 (상대 시간 표시)

## 개선 사항 제안
1. OpenAI API 키 설정 필요 (backend/.env)
2. 에러 처리 강화 (네트워크 오류, API 오류 등)
3. 파일 업로드 크기 제한 설정
4. 차트 자동 생성 로직 추가
5. 컬럼 자동완성 기능 구현
6. 테스트 코드 작성
7. 성능 최적화 (대용량 파일 처리)
8. 사용자 인증/권한 관리

## 주의사항
- OpenAI API 키를 설정해야 채팅 기능이 작동합니다
- Python 3.12 필수
- Node.js 24.x 이상 필요
- Docker 실행 환경 필요 (MongoDB)
- 가상환경은 backend/venv 에 위치
