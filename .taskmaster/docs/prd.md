<context>
# Overview
Whisper Mate는 음성을 녹음하면 자동으로 텍스트로 변환되어 클립보드에 즉시 복사되는 앱이다. 회의록 정리, 메모, 메시지 작성 등 텍스트 입력이 필요한 모든 상황에서 타이핑 대신 말하기로 대체하고자 하는 사람들을 위한 도구다. 기존 STT 도구들은 변환 결과를 별도 화면에서만 보여주거나, 클립보드 연동이 번거롭거나, 과거 변환 기록을 추적하기 어렵다는 문제가 있다. Whisper Mate는 "녹음 → 변환 → 클립보드 자동 삽입 → 필요하면 히스토리에서 재확인"이라는 최소한의 흐름에 집중해, 사용자가 어떤 앱에서든 바로 붙여넣기(Cmd/Ctrl+V)만 하면 되도록 만든다.

**개발 전략**: 먼저 브라우저에서 동작하는 웹 앱으로 핵심 기능(녹음-변환-클립보드-히스토리)을 완성하고 검증한 뒤, 동일한 코드베이스를 Electron으로 감싸 데스크톱 앱(macOS/Windows)으로 빌드한다. 즉 최종 배포 형태는 데스크톱 앱이지만, 개발 순서상 웹 앱이 선행되고 Electron 래핑은 후행 단계다.

# Core Features

## 1. 음성 녹음 및 STT 변환
- 무엇을 하는가: 마이크 입력을 녹음하고, OpenAI Whisper STT API로 전송하여 텍스트로 변환한다.
- 왜 중요한가: 앱의 핵심 가치 제안이며, 변환 정확도와 속도가 사용자 경험을 좌우한다.
- 작동 방식: 사용자가 단축키 또는 버튼으로 녹음을 시작/종료하면, 녹음된 오디오 파일이 Whisper API로 전송되고, 반환된 텍스트가 앱 상태에 저장된다.

## 2. 클립보드 자동 삽입
- 무엇을 하는가: 변환이 완료되면 결과 텍스트를 별도 조작 없이 시스템 클립보드에 자동으로 복사한다.
- 왜 중요한가: 사용자가 변환 결과를 수동으로 복사하는 단계를 없애 "말하고 바로 붙여넣기"라는 핵심 워크플로우를 완성한다.
- 작동 방식: STT 변환 완료 이벤트를 감지해 Electron의 클립보드 API를 통해 텍스트를 시스템 클립보드에 기록하고, 사용자에게 짧은 토스트/알림으로 완료를 알린다.

## 3. 변환 결과 확인 (미리보기)
- 무엇을 하는가: 방금 변환된 텍스트를 앱 내에서 바로 확인하고, 필요하면 수정할 수 있다.
- 왜 중요한가: STT는 완벽하지 않으므로, 붙여넣기 전에 오류를 빠르게 확인할 수 있어야 신뢰도가 높아진다.
- 작동 방식: 변환 완료 직후 결과 텍스트를 메인 화면에 표시하고, 편집 시 클립보드 내용도 함께 갱신한다.

## 4. 변환 히스토리
- 무엇을 하는가: 과거에 변환한 모든 텍스트를 시간순으로 조회, 검색, 재복사, 삭제할 수 있다.
- 왜 중요한가: 사용자가 이전에 말한 내용을 다시 찾아야 하는 경우가 많으며, 이는 단순 STT 도구와의 핵심 차별점이다.
- 작동 방식: 변환 결과를 Supabase DB에 저장하고, 히스토리 화면에서 리스트/검색 UI로 조회한다. 각 항목에서 "다시 클립보드에 복사" 액션을 제공한다.

## 5. 에러 추적 및 모니터링
- 무엇을 하는가: STT API 실패, 클립보드 접근 실패, DB 오류 등 런타임 에러를 Sentry로 실시간 추적한다.
- 왜 중요한가: 데스크톱 앱은 배포 후 사용자 환경에서 발생하는 문제를 파악하기 어려우므로 원격 에러 가시성이 필수적이다.
- 작동 방식: Sentry SDK를 Electron 메인/렌더러 프로세스 양쪽에 연동하고, 우선순위 높은 이슈에 대해 알림 규칙을 설정한다.

# User Experience

## 사용자 페르소나
- **바쁜 지식노동자**: 회의 중 메모, 이메일 초안, Slack 메시지 등을 빠르게 텍스트로 남기고 싶어하는 사용자. 타이핑보다 말하기가 빠르다고 느낀다.
- **접근성이 필요한 사용자**: 장시간 타이핑이 불편하거나 어려운 사용자로, 음성 입력이 주요 입력 수단이다.

## 핵심 사용자 흐름
1. 앱 실행(또는 트레이 상주) → 단축키/버튼으로 녹음 시작
2. 말하기 → 녹음 종료(단축키/버튼 재클릭)
3. 자동으로 STT 변환 진행 (로딩 인디케이터 표시)
4. 변환 완료 → 텍스트가 화면에 표시되고 클립보드에 자동 복사됨 (토스트 알림)
5. 필요 시 텍스트 미세 수정 → 다른 앱에 붙여넣기(Cmd/Ctrl+V)
6. 나중에 히스토리 탭에서 과거 변환 내용을 검색/재사용

## UI/UX 고려사항
- 최소한의 클릭으로 녹음을 시작할 수 있어야 한다 (전역 단축키 지원 고려).
- 변환 중 상태(녹음 중 / 변환 중 / 완료)를 명확히 시각적으로 구분한다.
- shadcn/ui 컴포넌트 기반의 깔끔하고 단순한 단일 화면 구조: 녹음 영역 + 최근 결과 + 히스토리 탭.
- 클립보드 복사 완료는 반드시 눈에 띄는 피드백(토스트)으로 확인시킨다.
- 다크/라이트 모드 지원 (기존 Tailwind 테마 토큰 활용).
</context>
<PRD>
# Technical Architecture

## 시스템 구성요소
- **프론트엔드**: React 19 + TypeScript + Vite, shadcn/ui(Tailwind v4) 기반 UI. 컴포넌트는 21st.dev Magic MCP로 초기 생성 후 커스터마이징.
- **데스크톱 셸**: Electron으로 웹 앱을 패키징. 메인 프로세스는 전역 단축키, 시스템 트레이, 클립보드 접근, 마이크 권한을 담당하고, 렌더러 프로세스는 기존 React 앱을 그대로 로드한다.
- **STT 연동**: OpenAI Whisper API (`audio/transcriptions` 엔드포인트)를 서버리스 함수(Supabase Edge Function) 또는 Electron 메인 프로세스를 통해 호출하여 API 키를 클라이언트에 노출하지 않는다.
- **백엔드/DB**: Supabase (Postgres + Auth + Edge Functions). Supabase MCP를 통해 스키마와 API를 관리한다.
- **에러 모니터링**: Sentry (기존 `src/lib/sentry.ts` 연동을 Electron 메인/렌더러 양쪽으로 확장).
- **E2E 테스트**: Playwright MCP로 녹음→변환→클립보드→히스토리 플로우에 대한 테스트 스크립트를 자동 생성 및 실행.
- **코드베이스 컨텍스트 관리**: Context7 MCP를 통해 라이브러리 문서/컨텍스트를 조회하며 기능을 개발.

## 데이터 모델 (Supabase)
`users`는 Supabase Auth 기본 테이블을 그대로 사용한다. 나머지 도메인 테이블은 아래 JSON 스키마로 정의한다.

```json
{
  "transcriptions": {
    "description": "음성 변환 결과 1건 = 히스토리 아이템 1건",
    "columns": {
      "id": { "type": "uuid", "constraint": "PK, default gen_random_uuid()" },
      "user_id": { "type": "uuid", "constraint": "FK -> auth.users.id, not null" },
      "raw_text": { "type": "text", "constraint": "not null", "description": "Whisper 원본 변환 결과" },
      "edited_text": { "type": "text", "constraint": "nullable", "description": "사용자가 수정한 최종 텍스트" },
      "audio_duration_seconds": { "type": "numeric", "constraint": "nullable" },
      "language": { "type": "text", "constraint": "nullable", "description": "예: 'ko', 'en'" },
      "created_at": { "type": "timestamptz", "constraint": "default now()" },
      "updated_at": { "type": "timestamptz", "constraint": "default now(), on update now()" }
    },
    "indexes": ["user_id, created_at desc"],
    "rls": "user_id = auth.uid() 인 행만 select/insert/update/delete 허용"
  },
  "settings": {
    "description": "사용자별 환경설정 (Phase 4, 향후 확장)",
    "columns": {
      "user_id": { "type": "uuid", "constraint": "PK, FK -> auth.users.id" },
      "shortcut_key": { "type": "text", "constraint": "nullable", "description": "예: 'CmdOrCtrl+Shift+R'" },
      "default_language": { "type": "text", "constraint": "nullable" },
      "updated_at": { "type": "timestamptz", "constraint": "default now()" }
    }
  }
}
```

**예시 레코드 (`transcriptions`)**
```json
{
  "id": "b3f1c9a0-1234-4a5b-9c3d-abcdef123456",
  "user_id": "6f0e7a2e-...",
  "raw_text": "오늘 회의에서 다음 주 배포 일정을 확정했습니다",
  "edited_text": null,
  "audio_duration_seconds": 4.8,
  "language": "ko",
  "created_at": "2026-07-09T09:12:03Z",
  "updated_at": "2026-07-09T09:12:03Z"
}
```

## API 및 통합
- OpenAI Whisper STT API: 오디오 파일 업로드 → 텍스트 반환.
- Supabase Auto-generated REST/Client API: `transcriptions` CRUD (생성, 목록 조회, 검색, 삭제).
- Electron IPC: 렌더러 ↔ 메인 프로세스 간 클립보드 쓰기, 전역 단축키 이벤트, 마이크 권한 요청 통신.
- Sentry: 프론트엔드(React ErrorBoundary) + Electron 메인 프로세스 예외 캡처.

## 인프라 요구사항
- Supabase 프로젝트(무료/개발 티어로 시작), API 키는 환경변수(`.env`)로 관리하며 클라이언트에는 publishable key만 노출.
- OpenAI API 키는 클라이언트에 절대 노출하지 않고 Edge Function/메인 프로세스에서만 사용.
- Electron 빌드 파이프라인(`electron-builder` 등)으로 macOS/Windows 배포 아티팩트 생성.
- 로컬 개발: 기존 Vite dev 서버를 Electron이 로드하는 구조(`npm run dev` + Electron dev 모드).

# Development Roadmap

## Phase 1 — MVP: 웹 앱으로 핵심 루프 완성
- 브라우저 마이크 권한 요청 및 녹음 기능 (MediaRecorder API)
- 녹음 시작/종료 UI (shadcn/ui 버튼, 상태 인디케이터)
- OpenAI Whisper API 연동 (Edge Function 경유 서버 사이드 호출)
- 변환 결과를 화면에 표시
- 웹 Clipboard API로 변환 결과 자동 복사 + 복사 완료 토스트
- Supabase 프로젝트 초기 설정 및 `transcriptions` 테이블 스키마 생성 (Supabase MCP 활용)
- 변환 결과를 Supabase에 저장하는 기본 흐름
- Sentry 프론트엔드 에러 캡처 연동 (기존 설정 확장)

## Phase 2 — 히스토리 및 편집 기능
- 히스토리 화면: 변환 목록 조회 (최신순), 페이지네이션/무한스크롤
- 히스토리 검색 (텍스트 기반 필터링)
- 히스토리 항목에서 "클립보드에 다시 복사" 액션
- 변환 결과 인라인 편집 및 `edited_text` 저장
- 히스토리 항목 삭제 기능
- Playwright MCP로 녹음→변환→클립보드→히스토리 E2E 테스트 스크립트 작성 및 자동 실행

## Phase 3 — 데스크톱 앱 전환 (Electron)
- Electron 프로젝트 셋업 및 기존 Vite/React 앱 렌더러로 통합
- 메인 프로세스: 시스템 클립보드 쓰기 IPC 핸들러
- 메인 프로세스: 마이크 권한 처리 및 OS별 권한 안내 UI
- 전역 단축키로 녹음 시작/종료 (앱이 백그라운드에 있어도 동작)
- 시스템 트레이 아이콘 및 트레이 메뉴 (녹음 시작, 히스토리 열기, 종료)
- Electron 메인 프로세스 Sentry 연동 (네이티브 크래시/예외 캡처)
- `electron-builder` 기반 macOS/Windows 빌드 및 배포 아티팩트 생성

## Phase 4 — 안정화 및 개선
- STT 실패/네트워크 오류에 대한 재시도 UX
- 다국어(언어 자동 감지 vs 수동 선택) 지원 개선
- 변환 정확도 향상을 위한 프롬프트/파라미터 튜닝 (Whisper `language`, `prompt` 파라미터 등)
- 사용자별 설정(단축키 커스터마이징, 기본 언어) 저장 (`settings` 테이블)
- Sentry 알림 규칙 세분화 (Slack 라우팅 등은 Sentry 웹 콘솔에서 수동 설정)
- 성능 최적화 (긴 녹음 파일 청크 업로드, 변환 대기 시간 단축)

# Logical Dependency Chain

빌드 순서는 아래 플로우를 따른다. 화살표(`→`)는 "선행 완료 후 착수", 대괄호 `[Phase N]`은 소속 단계를 뜻한다. 각 노드는 독립적으로 배포 가능한 단위이며, 어떤 단계에서도 "녹음 → 변환 → 클립보드" 핵심 루프를 깨지 않는다.

```
[Phase 1] 마이크 녹음 (MediaRecorder API)
        │  녹음 없이는 아무것도 시작 안 됨 → 최우선 기반
        ▼
[Phase 1] Whisper STT 연동 (Edge Function 경유)
        │  이 지점에서 "말하면 텍스트가 나온다" 시연 가능
        │  = 최소 동작 데모(clickable prototype) 완성
        ▼
        ├──▶ [Phase 1] 화면에 변환 결과 표시
        │           │
        │           ▼
        │    [Phase 1] 클립보드 자동 복사 + 토스트
        │           │  (핵심 차별점, 표시 기능 위에 바로 얹음)
        │
        └──▶ [Phase 1] Supabase `transcriptions` 저장
                    │  데이터가 쌓이기 시작해야 히스토리가 성립
                    ▼
             [Phase 2] 히스토리 목록 조회
                    │
                    ├──▶ [Phase 2] 히스토리 검색/필터
                    ├──▶ [Phase 2] 결과 인라인 편집 (edited_text)
                    ├──▶ [Phase 2] 항목 재복사 / 삭제
                    │
                    ▼
             [Phase 2] Playwright E2E 테스트 고정
                    │  (녹음→변환→클립보드→히스토리 플로우 회귀 방지)
                    ▼
             [Phase 3] Electron 셸 통합 (기존 웹 앱 그대로 로드)
                    │  웹 앱이 검증된 뒤에만 착수 → UI버그/플랫폼버그 분리
                    ▼
                    ├──▶ [Phase 3] 클립보드 IPC (네이티브)
                    ├──▶ [Phase 3] 전역 단축키
                    ├──▶ [Phase 3] 시스템 트레이
                    ├──▶ [Phase 3] Sentry 메인 프로세스 연동
                    │
                    ▼
             [Phase 3] electron-builder 배포 빌드 (macOS/Windows)
                    │
                    ▼
             [Phase 4] 안정화: 재시도 UX · 다국어 · 정확도 튜닝
                        · 사용자 설정(`settings`) · 성능 최적화
```

**핵심 포인트**
- Phase 1 안에서도 "녹음→변환→화면표시"가 끝나야 클립보드/저장 기능에 착수할 수 있다(순차 의존).
- 클립보드 복사와 Supabase 저장은 둘 다 "화면 표시" 이후에 병렬로 붙일 수 있는 독립 브랜치다.
- Phase 2의 검색/편집/재복사/삭제는 "히스토리 목록 조회"라는 공통 기반이 있어야만 각각 독립적으로 구현 가능하다.
- Phase 3(Electron)은 반드시 Phase 1~2(웹 앱)가 끝난 뒤 시작하며, 셸 통합 이후 네이티브 기능들은 서로 병렬로 진행 가능하다.

# Risks and Mitigations

## 기술적 도전
- **STT 정확도/지연시간**: Whisper API 응답 지연이 사용자 경험을 해칠 수 있음 → 로딩 상태를 명확히 표시하고, 짧은 오디오 우선 청크 업로드 등을 Phase 4에서 검토.
- **Electron 클립보드/마이크 권한의 OS별 차이**: macOS/Windows에서 권한 요청 플로우가 다름 → Phase 3에서 플랫폼별 수동 QA를 별도로 수행하고, 권한 거부 시 안내 UI를 제공.
- **API 키 노출 위험**: OpenAI/Supabase 키가 클라이언트에 노출되면 안 됨 → 반드시 Edge Function 또는 Electron 메인 프로세스를 경유해 호출하고, 클라이언트에는 publishable key만 사용.

## MVP 범위 설정
- 처음부터 Electron/전역 단축키/트레이까지 포함하면 범위가 커져 첫 데모가 늦어짐 → Phase 1은 순수 웹 앱(브라우저)으로 한정하여 핵심 가치(녹음→변환→클립보드)를 가장 빨리 검증하고, 데스크톱 전환은 이후 단계로 명확히 분리.
- 히스토리 검색/편집 같은 부가 기능이 MVP에 섞이지 않도록 Phase 2로 명확히 분리.

## 리소스 제약
- 1인 또는 소규모 팀 개발을 가정: MCP 도구(Supabase, Context7, Playwright, Sentry, Magic)를 적극 활용해 보일러플레이트(스키마 생성, UI 초안, 테스트 스크립트)를 자동화함으로써 개발 리소스를 핵심 로직에 집중.
- OpenAI API 사용량에 따른 비용 발생 가능 → 초기에는 사용자별 사용량 제한이나 알림은 없지만, Phase 4에서 필요 시 사용량 모니터링 추가를 검토.

# Appendix

## 활용 MCP/도구 매핑
- **Shadcn/ui + 21st.dev Magic MCP**: UI 컴포넌트 초안 생성 및 커스터마이징
- **Supabase MCP**: `transcriptions` 테이블 스키마 마이그레이션, 타입 생성, 프로젝트 관리
- **Context7 MCP**: React/Electron/Whisper API 등 라이브러리 최신 문서 조회
- **Playwright MCP**: 핵심 플로우(녹음→변환→클립보드→히스토리) E2E 테스트 자동 생성/실행
- **Sentry MCP**: 이슈 조회/분석 (알림 규칙 생성은 Sentry 웹 콘솔에서 수동 설정 — 기존 CLAUDE.md 참고)

## 기술 스펙 참고
- 프론트엔드 스택은 기존 리포지토리 구조(React 19 + Vite + TypeScript + Tailwind v4 + shadcn `base-nova` 스타일)를 그대로 승계한다.
- OpenAI Whisper STT API 엔드포인트: `POST /v1/audio/transcriptions` (multipart/form-data, 오디오 파일 업로드).
- Electron 패키징 도구는 `electron-builder` 사용을 기본 가정하되, 구현 단계에서 최종 확정한다.
</PRD>
