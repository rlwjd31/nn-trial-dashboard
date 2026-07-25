# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md
@docs/design.md

# Repository Topology (먼저 읽을 것)

⚠️ **`main` 브랜치에는 실행 코드가 없다.** `src/`·`package.json` 모두 없으며, 공용 지침·문서·API 계약만 있다.
코드는 형제 **워크트리**에 있다 (`git worktree list` 로 확인). 브랜치 전환 없이 폴더를 직접 열면 된다.

| 브랜치 | 워크트리 경로 | 소유 |
|---|---|---|
| `main` | `trial-dashboard/` | 공용 지침·문서·계약 (**코드 없음**) |
| `frontend` | `../trial-dashboard-frontend/` | Next.js 앱 (`src/**`, 프록시 Route Handler, `e2e/`) |
| `backend` | `../trial-dashboard-backend/` | n8n 워크플로우 + DB 레이어 설계 |

- 코드 작업 요청을 받으면 **해당 도메인 워크트리에서** 파일을 읽고 고친다. `main` 에서 `src/**` 를 찾지 말 것.
- **공용 문서**(`CLAUDE.md` · `AGENTS.md` · `docs/**`)는 **`main` 에서만** 고치고 `git switch frontend && git merge main` 으로 전파한다. 도메인 브랜치에서 직접 고치면 divergence 가 생긴다.
- 다른 브랜치 파일을 읽기만 할 땐 `git show backend:docs/backend/data-layer.md` 도 가능.

# Commands

패키지 매니저는 **pnpm**. 아래는 전부 `../trial-dashboard-frontend/` 에서 실행한다 (`main` 에는 스크립트가 없다).

```bash
pnpm dev                    # 개발 서버 (localhost:3000)
pnpm build                  # 프로덕션 빌드
pnpm lint                   # eslint (eslint-config-next)
pnpm test:e2e               # Playwright e2e 전체
pnpm exec playwright test e2e/precheck.spec.ts            # 파일 단위
pnpm exec playwright test -g "optimistic"                 # 제목 매칭 단위
pnpm exec playwright install chromium                     # 최초 1회 / 버전업 후
pnpm exec playwright show-trace test-results/**/trace.zip # 실패 원인 추적
```

- e2e 는 **직렬 실행**(`workers: 1`) — mock precheck 상태가 dev 서버 메모리에 남아 테스트 간 공유되기 때문. 상태를 바꾼 테스트는 반드시 원복한다. 규칙·알려진 함정은 [docs/testing.md](docs/testing.md).
- `webServer.reuseExistingServer: true` — dev 서버가 떠 있으면 재사용한다.
- 단위 테스트 러너는 **없다**(미도입).

# Mock Mode

**`N8N_BASE_URL` 이 비어 있으면 Route Handler 가 자동으로 mock 을 서빙한다** (`src/features/trials/mock/trials.mock.ts`). env 를 채우면 자동으로 n8n 프록시로 전환된다 — 코드 수정 불필요.
e2e 기대값은 이 mock 시드에 고정되어 있으므로, **시드를 바꾸면 `e2e/**` 의 단언값도 함께 갱신**해야 한다.

# Product Spec

이 프로젝트의 제품 요구사항은 [docs/PRD.md](docs/PRD.md) 에 정의되어 있다.
기능 구현·API·화면 작업 전 반드시 해당 문서를 참조한다.

핵심 요약:
- **목적**: Sales팀 3명용 내부 "오늘의 Trial" 대시보드 (MVP).
- **벤치마킹**: https://naonow-bi.vercel.app/sales_today_trials — **기능/정보구조 참조용**일 뿐. 디자인은 베끼지 않으며, PRD에 명시된 최소 기능만 구현한다.
- **디자인**: Modern + Glassmorphism (다크 기본). 토큰·규칙·컴포넌트 레시피는 [docs/design.md](docs/design.md) 가 단일 진실 공급원 — UI/스타일 작업 전 반드시 준수한다. (개요는 PRD §6.0.)
- **아키텍처**: 브라우저 → Next.js Route Handler(토큰·n8n URL 은닉) → n8n Webhook(고정 IP) → GCP Cloud SQL. 프론트는 DB에 직접 붙지 않는다.
- **인증**: 서버 전용 환경변수 `N8N_BASE_URL`, `N8N_API_TOKEN` (절대 `NEXT_PUBLIC_` 금지). n8n 호출 시 `x-api-key` 헤더 부착.
- **프록시 엔드포인트**(계약 기준): `/api/trials`(GET, no-store) · `/api/trials/{id}`(GET) · `/api/trials/pre-trial-call-check`(PATCH) · `/api/trials/note`(PATCH).
  ⚠️ 현재 프론트 코드는 구(舊) 이름(`/api/trials/precheck`)에 머물러 있고 `note` 라우트가 없다 — **계약 미수렴 상태**. 미반영 항목 목록은 [docs/contract/api-contract.md](docs/contract/api-contract.md) "프론트 변경 체크리스트".
- **최신성**: TanStack Query `staleTime` 60s + `refetchOnWindowFocus`. 체크박스는 optimistic update(실패 시 롤백).
- **명시적 비목표**: 로그인 시스템, 실시간 동기화(웹소켓/폴링), 페이지네이션, 정렬/필터/검색 UI, 모바일 최적화 → 구현하지 않는다 (over-engineering 방지).
- **데이터 계약**: `public` 스키마는 라이브 확인 완료([docs/backend/guide.md](docs/backend/guide.md) §4). 다만 **타임존(`startAt`) 은 미해결** 상태이고, PRD §9 의 나머지 미확정 항목은 구현 전 확인이 필요하다.

# Domains & Contract (front / back 공유)

이 저장소는 두 도메인으로 나뉜다. 작업 전 자기 도메인 가이드를 읽고, 경계는 계약을 따른다.

- **공유 계약(boundary)**: [docs/contract/openapi.yaml](docs/contract/openapi.yaml) = API 모양의 단일 진실 공급원(SoT).
  변경 프로토콜·프론트 핸드오프: [docs/contract/api-contract.md](docs/contract/api-contract.md).
  응답/요청 모양을 바꿀 땐 **openapi 를 먼저** 고치고 front·back 이 각자 수렴한다.
- **프론트 도메인**: UI(`src/features`, `src/components`) + 프록시(`src/app/api`).
  가이드 = [docs/design.md](docs/design.md)(디자인·설계) + [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)(폴더 구조, feature-lite: 도메인은 `features/trials` 하나뿐).
  기능 스펙(해당 기능을 건드릴 때만): [cloudtalk-call-button.md](docs/cloudtalk-call-button.md)(`ct+tel:` 딥링크·E.164) · [ptc-call-notes.md](docs/ptc-call-notes.md)(MDXEditor, `dynamic{ssr:false}`) · [testing.md](docs/testing.md).
- **백엔드 도메인**: n8n 워크플로우 + DB(별도 repo `../n8n-workflows`). 가이드 = [docs/backend/guide.md](docs/backend/guide.md).
  배포 SoT = n8n 클라우드 워크플로우. **DDL·DB 변경은 DB 소유자**가 한다(`public` 스키마는 읽기 전용).
- **규칙**: 프론트는 `src/**` 만, 백엔드는 n8n/DB 만 건드린다. **엔드포인트·응답 모양의 최신 정의는 위 계약(openapi)이 우선**한다(아래 Product Spec 요약이 계약과 다르면 계약이 SoT).

# Commit Convention

이 저장소의 모든 commit 메시지는 반드시 아래 형태를 따른다.

```
[Type]: Description
```

- `[Type]` — 대괄호로 감싼 변경 유형 (아래 표 중 하나).
- `: ` — 콜론 + 공백 한 칸.
- `Description` — 변경 내용을 명령형 현재시제로 간결하게.

## 예시

```
[Feat]: add trials list route handler
[Fix]: correct precheck stage validation
[Docs]: update README data contract section
```

## Type 목록

| Type | 용도 |
|---|---|
| `Feat` | 새 기능 |
| `Fix` | 버그 수정 |
| `Docs` | 문서 변경 |
| `Style` | 포맷/세미콜론 등 동작에 영향 없는 변경 |
| `Refactor` | 기능 변화 없는 코드 구조 개선 |
| `Test` | 테스트 추가/수정 |
| `Chore` | 빌드/설정/의존성 등 그 외 |

## 규칙

- Type 은 위 표의 값만 사용한다.
- 표기는 위 표 그대로 쓴다 (`[Feat]`, `[Fix]` …).
- 한 commit 은 하나의 논리적 변경만 담는다.
