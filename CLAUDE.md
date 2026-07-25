# CLAUDE.md — backend 도메인

이 파일은 `backend` 워크트리(= `trial-dashboard/backend/`) **전용** 규칙이다.

> **공용 규칙은 상위 `../CLAUDE.md`(main 워크트리)가 갖고 있고, 이 폴더에서 세션을 열면 자동으로 함께 로드된다.**
> 커밋 규약 · Product Spec · 프론트 설계는 전부 거기 있다 — **여기에 복사하지 말 것.**
> `../AGENTS.md` · `../docs/PRD.md` · `../docs/design.md` · `../docs/ARCHITECTURE.md` 는 상위(main)에만 있다.
> **단, 계약·백엔드 문서는 이 브랜치가 소유한다** → `docs/contract/**` · `docs/backend/**` (로컬 경로, `../` 아님).

# 이 브랜치의 범위

**backend = ① n8n 워크플로우 + API 생성 ② 응답 ↔ API 스펙 대조 검증.**
UI(컴포넌트·훅·스타일·페이지)는 이 브랜치에 **없다** — `frontend` 브랜치 소유다.
프론트↔백엔드는 코드 의존이 없고 **JSON 계약**(`docs/contract/openapi.yaml`)으로만 연결된다.

이 브랜치에 있는 것: `src/app/api/**`(4 라우트) · `src/lib/{n8n,api}.ts` · `src/types/trial.ts` ·
`src/features/trials/mock/trials.mock.ts` · `test/contract-check.mts` · `docs/{contract,backend}/**`.

## worktree 배치

| 경로 | 브랜치 | 역할 |
|---|---|---|
| `../` (`trial-dashboard`) | `main` | 공용 문서 전용 — **앱 소스 없음**(package.json·src 없음) |
| `.` (`trial-dashboard/backend`) | `backend` | **여기** — n8n + API 계층 + 계약 |
| `../frontend` | `frontend` | 화면 (자체 node_modules 보유) |
| `../../n8n-workflows` | (git 미추적) | n8n 워크플로우/스키마 문서 저장소 |

`backend`·`frontend` 워크트리는 main 워킹트리 **안에** 중첩돼 있고 main 의 `.gitignore` 가 제외한다.
⚠ main 에서 `git clean -fdx` 금지(중첩 워크트리가 지워진다). 브랜치명과 폴더명이 겹치므로 main 에서
`git diff main backend` 같은 명령은 모호해진다 → `refs/heads/backend` 또는 `--` 를 쓴다.
브랜치 간 파일을 볼 때 `git checkout` 하지 말고 형제 폴더를 직접 열거나 `git show <branch>:<path>`.

# 명령어

이 워크트리는 **자체 `node_modules`** 를 갖는다(예전의 `../node_modules` 심볼릭 링크는 폐기).
의존성은 next·react·react-dom + 타입/eslint 뿐이라 설치가 가볍다. 전부 여기서 동작한다:

```bash
pnpm install
pnpm dev                      # Route Handler 만 서빙 (화면 없음)
pnpm build                    # ✅ 검증됨 — /api/trials, /api/trials/[id], .../note, .../pre-trial-call-check
pnpm lint
pnpm test:contract            # mock 응답 ↔ openapi.yaml 대조 (서버 불필요)
pnpm test:contract:selftest   # 검증기 자체 점검
node test/contract-check.mts --base http://localhost:3000/api      # 라이브 라우트 대조
node test/contract-check.mts --base https://<host>/webhook --n8n   # n8n 웹훅 직접 대조
```

`docs/` 는 tsconfig `exclude` 에 있다 — `docs/backend/workflow.ts` 가 미설치 패키지
`@n8n/workflow-sdk` 를 import 하는 기록 사본이기 때문(예전의 상시 TS2307 은 이걸로 해소됨).

테스트 러너(vitest/jest)는 없다. 계약 검증은 위 zero-dep 러너가 담당한다.

# 아키텍처

## 요청 경로
```
브라우저 → /api/trials* (Next Route Handler, 서버) → n8n Webhook(고정 IP) → GCP Cloud SQL (DB naonow)
```
Route Handler 가 유일한 서버 경계다. `N8N_BASE_URL`/`N8N_API_TOKEN` 은 `src/lib/n8n.ts`(`import "server-only"`)
안에서만 읽고 `x-api-key` 를 부착한다. 모든 응답 `no-store`.

## 엔드포인트 4개
| 프론트 | n8n | 메서드 |
|---|---|---|
| `/api/trials` | `/webhook/trials/today` | GET |
| `/api/trials/{id}` | `/webhook/trials/detail?trial_id=` | GET |
| `/api/trials/pre-trial-call-check` | `/webhook/trials/pre-trial-call-check` | PATCH |
| `/api/trials/note` | `/webhook/trials/note` | PATCH |

## mock 폴백
모든 Route Handler 는 `const USE_MOCK = !process.env.N8N_BASE_URL` 로 분기해
`src/features/trials/mock/trials.mock.ts`(인메모리, 쓰기까지 반영)를 서빙한다.
현재 `.env.local` 의 `N8N_*` 는 비어 있다 → **로컬 기본값은 mock 모드.**
mock 응답 모양은 계약과 일치해야 한다(`pnpm test:contract` 가 이걸 지킨다).

## 계층 경계
`@/lib/api → app/api/**/route.ts → @/lib/n8n → n8n`. 역방향 import 금지.
`src/lib/api.ts` 는 프론트가 쓰는 클라이언트지만 **계약의 클라 측면**이므로 이 브랜치가 유지한다.

## 문서 지도 (무엇이 SoT인가)
| 문서 | 소유 | 역할 |
|---|---|---|
| `docs/contract/openapi.yaml` | **backend** | **API 계약 SoT** — 요청/응답 모양은 여기를 먼저 고친다 |
| `docs/contract/api-contract.md` | **backend** | 프론트 handoff 체크리스트 |
| `docs/contract/frontend-data-needs.md` | **backend** | UI 실사용 필드 역산 |
| `docs/backend/guide.md` | **backend** | **백엔드 작업 규칙 — 작업 전 필독** |
| `docs/backend/data-layer.md` | **backend** | 쿼리·스키마 설계 이력 |
| `docs/backend/ddl.sql` | **backend** | 상태 테이블 스펙 (DB 소유자가 실행) |
| `docs/backend/workflow.ts` | **backend** | 배포된 n8n 워크플로우 기록 사본 (배포 수단 아님) |
| `../docs/PRD.md` · `../docs/design.md` · `../docs/ARCHITECTURE.md` | main | 제품·디자인·폴더 규칙 |

# 백엔드 작업 규칙 (요약 — 상세는 docs/backend/guide.md)

- **배포 SoT = n8n 클라우드 워크플로우** "[Trial API] - Main" (id `OHSTgJsHd6337qgf`, project Nao Now).
  변경은 n8n MCP `update_workflow` 로 하고, 그 후 `docs/backend/workflow.ts` 를 동기화 커밋한다.
- **n8n MCP 사용 순서(생략 금지)**: `get_sdk_reference` → 관련 `get_workflow_best_practices` →
  `search_nodes` → `get_node_types`(쓸 노드 전부, discriminator 포함) → 코드 작성 →
  `validate_workflow` → `update_workflow` → `execute_workflow`(manual)로 실데이터 검증.
- **`public` 스키마는 읽기 전용.** SELECT 만, 항상 스키마 수식(`public."Lessons"`). PascalCase 컬럼은 큰따옴표.
- **대시보드 상태는 `automation` 스키마** = snake_case (`automation.trial_dashboard_state`).
- **DDL·프로덕션 쓰기는 Claude 가 직접 실행하지 않는다.** DB 소유자가 실행하고, 워크플로우는 테이블 존재를 가정한다.
- Postgres 자격증명: `automation_coupons` (id `TYGrEaGEtyIrZUHe`, DB `naonow` 프로덕션).
  읽기 검증은 임시 워크플로우로 하고 **실행 후 아카이브**.
- n8n 체인 패턴: `Webhook(responseMode: responseNode) → Postgres(executeQuery) → respondToWebhook`.
  파라미터는 `options.queryReplacement` 에 **배열 표현식** `={{ [$json...] }}` (콤마 split 회피).

# 라이브 검증 사실 (2026-07-25)

- `automation` 스키마 존재 O, **`automation.trial_dashboard_state` 존재 X** → n8n 4 엔드포인트 전부 500
  (`relation "automation.trial_dashboard_state" does not exist`). `ddl.sql` 실행이 유일한 해제 조건.
- 워크플로우 **미발행**: `active: false`, `activeVersionId: null` → production webhook URL 서빙 안 됨. 인증도 `none`.
- **타임존 버그(테이블과 무관)**: `Lessons.startAt` 은 `timestamp without time zone` + **UTC 저장**
  (`max(createdAt)` ≈ `now()` UTC 로 확인). 배포 쿼리의 `startAt AT TIME ZONE 'Asia/Seoul'` 은 naive 값을
  서울 시각으로 *해석*해 9시간을 빼고 거기에 `+09:00` 을 붙인다 → 표시 시각 **18시간 오차**,
  오늘 필터 창도 밀려 KST 00:00–17:59 시작 trial 이 누락된다.
  올바른 식: `startAt AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul'` (detail 의 `trial_date` 도 동일).
- distinct 실측: `Mentors.tier` = `elite, normal`(**`basic` 없음**) · `Mentors.gender` = `female, male, nonbinary` ·
  trial 의 `Lessons.status` = `approved, canceled, completed, paid`(`scheduled` 는 trial 행에 없음).
- 그 외: 학생 이름은 `Students.firstName+lastName` → 없으면 `koreanEquivalent` · `CallQueues.studentId` 로 조인 ·
  `converted = lifecycle='converted' OR purchasedAt IS NOT NULL` · sales rep 표시명은 `Users.email` local-part(임시).

# 계약 정합 상태

이 브랜치의 코드·mock·스펙은 서로 일치한다(`pnpm test:contract` 통과, mock/라이브 모두).
**남은 drift 는 `frontend` 브랜치 쪽**이며 할 일 목록은 [docs/contract/api-contract.md](docs/contract/api-contract.md) 가 SoT다.
요청/응답 모양을 바꿀 때는 **openapi.yaml 을 먼저 고치고** n8n·프론트가 각자 수렴한다.
