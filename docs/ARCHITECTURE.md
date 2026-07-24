# 폴더 구조 가이드 (Folder Structure Guide)

이 문서는 `trial-dashboard`의 코드 배치 규칙을 정의한다. 화면·기능·유틸을
추가할 때 **어디에 둘지 고민 없이** 결정하기 위한 단일 기준이다.

> 대전제: 이 프로젝트는 Sales팀 3명용 단일 도메인(trials) MVP다.
> 실무 정설(feature 기반)의 *원칙*은 채택하되, `features/ + shared/ + core/`
> 풀 트리를 그대로 복사하지 않는다(over-engineering 방지, PRD §2 비목표).
> → **feature-lite**: 도메인이 하나이므로 `features/trials` 하나만 둔다.

## 1. 설계 원칙 (실무 정설에서 채택)

1. **`app/`은 라우팅 + 서버 경계만.** 페이지는 feature를 조합(compose)할 뿐,
   비즈니스 로직·복잡한 UI를 직접 들고 있지 않는다. Route Handler(n8n 프록시)도
   서버 경계이므로 `app/api/`에 둔다.
2. **타입별이 아니라 도메인별로 co-locate.** `components/`, `hooks/`, `utils/`를
   전역에 흩뿌리지 않고, 한 도메인에 필요한 것을 `features/<domain>/` 안에 모은다.
3. **교차 재사용만 전역으로.** 여러 도메인이 쓰는 원자 컴포넌트는
   `components/ui`(shadcn), 저수준 유틸은 `lib/`, 전역 계약 타입은 `types/`.
4. **의존성은 한 방향.** `UI(components) → hooks → api → (자기 도메인) route handler`.
   역방향 import 금지. `features/` 는 `components/ui`·`lib`·`types`를 import 할 수
   있지만, 그 반대는 안 된다.
5. **절대 경로 import.** 항상 `@/...` (예: `@/features/trials/hooks/useTrials`).

## 2. 디렉토리 트리

```
src/
├─ app/                          # 라우팅 + 서버 경계만
│  ├─ api/trials/                #   서버 전용 n8n 프록시 (Route Handler)
│  │  ├─ route.ts                #     GET  /api/trials
│  │  ├─ [id]/route.ts           #     GET  /api/trials/[id]
│  │  └─ precheck/route.ts       #     PATCH /api/trials/precheck
│  ├─ layout.tsx                 #   루트 레이아웃 (Providers 주입)
│  ├─ providers.tsx              #   QueryClient / TooltipProvider 등 클라 프로바이더
│  ├─ page.tsx                   #   대시보드 라우트 — features/trials 조합만
│  └─ globals.css                #   Tailwind v4 + shadcn 테마 토큰
│
├─ features/
│  └─ trials/                    # ★ 유일한 도메인 (오늘의 Trial)
│     ├─ components/             #   TrialTable, TrialRow, StatCard,
│     │                          #   TrialDetailSheet, PrecheckCheckbox ...
│     ├─ hooks/                  #   useTrials, useTrialDetail, usePrecheckMutation
│     ├─ api/                    #   브라우저 → 자기 도메인(/api/*) fetch 클라이언트
│     └─ lib/                    #   집계(카드 수치)·포맷 등 feature 전용 순수 함수
│
├─ components/
│  └─ ui/                        # shadcn 생성물 (원자 컴포넌트, 직접 편집 지양)
│
├─ lib/                          # 앱 전역 저수준 유틸
│  ├─ n8n.ts                     #   서버 전용 n8n 프록시 헬퍼 (x-api-key 부착)
│  ├─ api.ts                     #   (현행 유지) 브라우저 API 클라이언트 베이스
│  └─ utils.ts                   #   cn() 등 shadcn 유틸
│
└─ types/
   └─ trial.ts                   # 전역 API 계약 타입 (PRD §7 기준)
```

## 3. "이건 어디에 두지?" 결정 트리

| 만들려는 것 | 위치 |
|---|---|
| trials 화면 전용 컴포넌트 | `features/trials/components/` |
| trials 데이터 조회/변경 훅 | `features/trials/hooks/` |
| 브라우저 → `/api/*` 호출 함수 | `features/trials/api/` |
| 카드 수치 집계·날짜 포맷 등 순수 로직 | `features/trials/lib/` |
| 버튼·카드 등 도메인 무관 원자 UI | `components/ui/` (shadcn add) |
| 여러 도메인 공용 저수준 유틸 | `lib/` |
| n8n 프록시 등 서버 전용 코드 | `app/api/**` + `lib/n8n.ts` |
| API 응답/요청 계약 타입 | `types/trial.ts` |
| 새 라우트(URL) | `app/<segment>/page.tsx` (로직은 feature로) |

## 4. 확장 규칙 (도메인이 늘어날 때)

지금은 도메인이 `trials` 하나라 `features/trials`만 있다. 두 번째 도메인
(예: `mentors`, `students`)이 생기면:

1. `features/<new-domain>/` 를 같은 하위 구조(`components/hooks/api/lib`)로 만든다.
2. **두 도메인이 공유**하게 된 컴포넌트만 그때 `components/`(ui 밖) 또는
   `shared/`로 승격한다. **미리 만들지 않는다** (YAGNI).
3. 그 전까지 `shared/`·`core/`·`services/` 같은 폴더는 만들지 않는다.

## 5. 현재 상태 메모

- `lib/api.ts`, `types/trial.ts` 는 **당장 이동하지 않는다.** 규모가 작아
  이관 이득보다 diff 비용이 크다. 화면 구현이 본격화될 때 위 표 기준으로
  자연스럽게 `features/trials/`로 흡수할지 판단한다.
- `features/trials/*` 하위는 현재 스캐폴딩(빈 폴더 + README)만 존재한다.
  실제 파일은 마일스톤 3~5(목록/상세/체크박스) 구현 시 채운다.
