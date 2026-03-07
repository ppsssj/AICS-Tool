# AICS-Tool Frontend MVP

React, TypeScript, Vite, Tailwind CSS 기반의 연구실 워크플로 플랫폼 프론트엔드 MVP입니다.

## 1. 실행 방법

### 요구 사항
- Node.js 20 이상
- npm 10 이상

### 의존성 설치
```bash
npm install
```

### 개발 서버 실행
```bash
npm run dev
```

Vite가 출력하는 로컬 주소로 접속하면 됩니다. 기본 주소는 `http://localhost:5173`입니다.

### 프로덕션 빌드
```bash
npm run build
```

### 빌드 결과 미리보기
```bash
npm run preview
```

## 2. 주요 화면 기능

### 대시보드
- 이번 주 기준의 운영 화면입니다.
- 긴급 작업, 임박한 마감, 리뷰 대기, 조율 리스크를 우선적으로 보여줍니다.
- 내 작업 큐에서 프로젝트와 문서 맥락으로 바로 이동할 수 있습니다.

### 프로젝트 목록
- 프로젝트를 단순 목록이 아니라 운영 상태 중심으로 보여줍니다.
- 마감 임박 작업, 리뷰 대기, 차단 작업, 다음 공유 세션 같은 신호를 카드에서 바로 확인할 수 있습니다.

### 프로젝트 상세
- 프로젝트의 현재 상태를 중심으로 구성됩니다.
- 다음 마일스톤, 지연 작업, 이번 주 작업, 리뷰 대기, 차단 상태, 공유 일정 등을 한 화면에서 확인할 수 있습니다.
- 개요, 문서, 작업, 일정, 멤버 섹션이 자연스럽게 이어집니다.

### 작업 보드
- 상태 변경을 빠르게 처리할 수 있는 작업 중심 보드입니다.
- 삭제 확인, 일괄 작업, 우선순위/마감/담당자/문서 연결 변경을 지원합니다.
- 프로젝트, 일정, 연결 문서로 바로 이동할 수 있습니다.

### 캘린더
- 전체 날짜/시간 표기를 한국어 기준으로 맞췄습니다.
- 월간, 주간, 일간 뷰의 역할을 분리했습니다.
- 일정과 시간표 제약 블록을 구분해서 보여줍니다.
- 우측 상세 패널은 빈 상태와 선택 상태를 명확히 구분합니다.

### 설정
- 테마와 사용자 설정을 관리하는 화면입니다.

## 3. AI 워크스페이스와 프로젝트 컨텍스트

앱 헤더에는 현재 실제 LLM API 없이 동작하는 `AI 워크스페이스`가 포함되어 있습니다.  
이 기능은 나중에 LLM을 붙이기 위한 앱 쪽 컨텍스트 전환 구조를 먼저 구현한 것입니다.

### 현재 가능한 동작
- `졸업작품 프로젝트 열기`
- `이 프로젝트 작업 보드 보여줘`
- `반도체 분석 일정 열기`
- `현재 프로젝트 문서 보여줘`

위와 같은 자연어 입력을 기반으로 현재 store 안의 프로젝트를 찾고, 적절한 프로젝트 워크스페이스나 탭으로 이동합니다.

### 동작 방식
- 프로젝트명이 명확하면 해당 프로젝트 컨텍스트를 활성화하고 바로 이동합니다.
- 비슷한 후보가 여러 개면 선택 가능한 제안 목록을 보여줍니다.
- 사용자가 현재 프로젝트 안에 있으면 `이 프로젝트`, `현재 프로젝트` 같은 표현을 현재 컨텍스트 기준으로 해석합니다.
- 사용자가 직접 `/projects/:projectId` 라우트로 들어가도 앱이 자동으로 활성 프로젝트 컨텍스트를 동기화합니다.
- 문서 상세 라우트에서는 활성 문서 컨텍스트도 함께 맞춰집니다.

### Zustand에 저장되는 컨텍스트 상태
- `activeProjectId`
- `activeDocumentId`
- `recentProjectIds`

### 지원하는 컨텍스트 이동 범위
- 프로젝트 워크스페이스 열기
- 현재 프로젝트 문서 열기
- 현재 프로젝트 작업 보드 열기
- 현재 프로젝트 일정 열기
- 최근 사용한 프로젝트 컨텍스트 다시 열기

### 관련 파일
- [`src/app/layouts/app-layout.tsx`](/c:/Users/박성진/Documents/AICS-Tool/src/app/layouts/app-layout.tsx)
- [`src/app/store/use-lab-store.ts`](/c:/Users/박성진/Documents/AICS-Tool/src/app/store/use-lab-store.ts)
- [`src/features/assistant/mock-project-assistant.ts`](/c:/Users/박성진/Documents/AICS-Tool/src/features/assistant/mock-project-assistant.ts)

## 4. 라우트

- `/login`
- `/dashboard`
- `/projects`
- `/projects/:projectId`
- `/projects/:projectId/docs`
- `/projects/:projectId/docs/:docId`
- `/projects/:projectId/tasks`
- `/projects/:projectId/schedule`
- `/projects/:projectId/members`
- `/calendar`
- `/settings`

AI 워크스페이스는 별도 페이지가 아니라 로그인 이후 공통 레이아웃 헤더 안에서 동작합니다.

## 5. 파일 구조

```text
AICS-Tool/
|-- public/
|-- src/
|   |-- app/
|   |   |-- layouts/
|   |   |   `-- app-layout.tsx
|   |   |-- store/
|   |   |   `-- use-lab-store.ts
|   |   `-- App.tsx
|   |-- entities/
|   |   `-- models.ts
|   |-- features/
|   |   |-- assistant/
|   |   |   `-- mock-project-assistant.ts
|   |   |-- auth/
|   |   |-- calendar/
|   |   |-- documents/
|   |   |-- projects/
|   |   `-- tasks/
|   |-- mock/
|   |   `-- data.ts
|   |-- pages/
|   |   |-- login-page.tsx
|   |   |-- dashboard-page.tsx
|   |   |-- projects-page.tsx
|   |   |-- project-detail-page.tsx
|   |   |-- document-page.tsx
|   |   |-- task-board-page.tsx
|   |   |-- calendar-page.tsx
|   |   |-- settings-page.tsx
|   |   `-- not-found-page.tsx
|   |-- shared/
|   |   |-- lib/
|   |   `-- ui/
|   |-- index.css
|   `-- main.tsx
|-- docs/
|   |-- llm-project-context-architecture.md
|   |-- llm-system-prompt.txt
|   |-- llm-dynamic-context-template.txt
|   `-- llm-tool-schema-example.json
|-- index.html
|-- package.json
|-- postcss.config.js
|-- tailwind.config.ts
|-- tsconfig.app.json
|-- tsconfig.json
`-- vite.config.ts
```

## 6. NPM 스크립트

- `npm run dev`: 개발 서버 실행
- `npm run build`: TypeScript 검사 후 프로덕션 번들 생성
- `npm run preview`: 빌드 결과 로컬 미리보기

## 7. 참고 사항

- 현재 assistant는 실제 외부 LLM API를 호출하지 않고, Zustand 상태를 기반으로 동작하는 mock 오케스트레이션입니다.
- 나중에 실제 LLM이나 tool-calling 레이어를 붙이더라도, 현재의 프로젝트 컨텍스트 구조를 그대로 재사용할 수 있도록 설계했습니다.
