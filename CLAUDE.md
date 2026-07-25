# CLAUDE.md — backend 도메인

이 파일은 `backend` 워크트리(= `trial-dashboard/backend/`) **전용** 규칙이다.

> **공용 규칙은 상위 `../CLAUDE.md`(main 워크트리)가 갖고 있고, 이 폴더에서 세션을 열면 자동으로 함께 로드된다.**
> 저장소 구조 · 브랜치 경계 · 계약 변경 알림 프로토콜 · Product Spec · 커밋 규약은 전부 거기 있다 —
> **여기에 복사하지 말 것** (사본이 둘이 되면 어느 쪽이 진짜인지 알 수 없게 된다).
> `AGENTS.md` · `docs/**` 도 상위에만 있다 → `../AGENTS.md` · `../docs/**`.
> 아래 본문의 `docs/…` 표기는 모두 그 상위 사본을 가리킨다.

# 이 디렉토리의 정체 (worktree)

`~/workspace/naonow/trial-dashboard-backend` 는 `trial-dashboard` 레포의 **`backend` 브랜치 git worktree** 다
(`.git` 은 gitdir 파일). 형제 워크트리:

| 경로 | 브랜치 | 역할 |
|---|---|---|
| `../trial-dashboard` | `main` | 프론트 실행/개발 (실제 `node_modules` 보유) |
| `../trial-dashboard-backend` | `backend` | **여기** — n8n 워크플로우 + DB 데이터 레이어 + 계약 문서 |
| `../trial-dashboard-frontend` | `frontend` | 프론트 작업용 |
| `../n8n-workflows` | (git 미추적) | n8n 워크플로우/스키마 문서 저장소 |

**이 워크트리의 작업 범위 = n8n 워크플로우 + DB + `docs/`.** `src/**`(프론트)는 여기서 수정하지 않는다.
프론트↔백엔드는 코드 의존이 없고 **JSON 계약**(`docs/contract/`)으로만 연결된다.
브랜치 간 파일을 볼 때 `git checkout` 하지 말고 형제 워크트리 폴더를 직접 열거나 `git show <branch>:<path>` 를 쓴다.

# 명령어

`node_modules` 는 `../trial-dashboard/node_modules` **심볼릭 링크**다. 이 때문에:

- ❌ `pnpm dev` / `pnpm build` — Turbopack 이 프로젝트 루트 밖을 가리키는 심링크를 거부한다
  (`Symlink [project]/node_modules is invalid, it points out of the filesystem root`).
  또한 `pnpm <script>` 자체가 deps 검증에서 `pnpm install` 을 트리거해 심링크 삭제를 시도하다 실패한다.
  → **앱을 띄우거나 빌드할 일이 있으면 `../trial-dashboard`(main) 워크트리에서 한다.**
- ✅ `npx eslint` — 여기서 정상 동작 (lint 는 node 해석이므로 심링크 무관).
- ⚠ `npx tsc --noEmit` — `docs/backend/workflow.ts` 가 미설치 패키지 `@n8n/workflow-sdk` 를 import 하므로
  TS2307 하나가 항상 남는다. 이 파일은 배포 기록 사본이며 앱 번들에 포함되지 않는다. 그 외 에러만 실제 문제로 취급.

테스트 러너는 없다 (MVP 비목표).

# 아키텍처

## 요청 경로
```
브라우저 → /api/trials* (Next Route Handler, 서버) → n8n Webhook(고정 IP) → GCP Cloud SQL (DB naonow)
```
Route Handler 가 유일한 서버 경계다. `N8N_BASE_URL`/`N8N_API_TOKEN` 은 `src/lib/n8n.ts`(`import "server-only"`)
안에서만 읽고 `x-api-key` 를 부착한다. 모든 응답은 `no-store`.

## 엔드포인트 4개 (프론트 ↔ n8n)
| 프론트 | n8n | 메서드 |
|---|---|---|
| `/api/trials` | `/webhook/trials/today` | GET |
| `/api/trials/{id}` | `/webhook/trials/detail?trial_id=` | GET |
| `/api/trials/pre-trial-call-check` | `/webhook/trials/pre-trial-call-check` | PATCH |
| `/api/trials/note` | `/webhook/trials/note` | PATCH |

## mock 폴백
모든 Route Handler 는 `const USE_MOCK = !process.env.N8N_BASE_URL` 로 분기해
`src/features/trials/mock/trials.mock.ts`(인메모리, 쓰기까지 반영)를 서빙한다.
env 를 채우면 자동으로 n8n 프록시로 전환된다 — 코드 수정 불필요.
현재 `.env.local` 에는 `N8N_*` 가 비어 있다 → **로컬 기본값은 mock 모드**. n8n 실연동 확인은 env 를 채운 뒤에만 가능.

## 계층 경계 (의존 방향 한 방향)
`features/trials/components → hooks → @/lib/api → app/api/**/route.ts → @/lib/n8n → n8n`.
역방향 import 금지. 폴더 배치 결정은 [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)(feature-lite: 도메인은 `trials` 하나)를 따른다.

## 문서 지도 (무엇이 SoT인가)
| 문서 | 역할 |
|---|---|
| `docs/PRD.md` | 제품 요구·비목표 |
| `docs/design.md` | 디자인 토큰/컴포넌트 + 프론트 설계 (자동 로드) |
| `docs/ARCHITECTURE.md` | 폴더 구조 규칙 |
| `docs/contract/openapi.yaml` | **API 계약 SoT** — 요청/응답 모양은 여기를 먼저 고친다 |
| `docs/contract/api-contract.md` | 프론트 handoff (계약 변경 시 프론트가 할 일 목록) |
| `docs/contract/frontend-data-needs.md` | UI 실사용 필드 역산 |
| `docs/backend/guide.md` | **백엔드 작업 규칙 — 백엔드 작업 전 필독** |
| `docs/backend/data-layer.md` | 쿼리·스키마 설계 이력 (§2·§3 인라인 SQL 은 구버전 `sales."TrialDashboardState"` 기준 → `ddl.sql`/`workflow.ts` 가 우선) |
| `docs/backend/ddl.sql` | 상태 테이블 스펙 (DB 소유자가 실행) |
| `docs/backend/workflow.ts` | 배포된 n8n 워크플로우의 **기록 사본** (배포 수단 아님) |

# 백엔드 작업 규칙 (요약 — 상세는 docs/backend/guide.md)

- **배포 SoT = n8n 클라우드 워크플로우** "[Trial API] - Main" (id `OHSTgJsHd6337qgf`, project Nao Now).
  변경은 n8n MCP `update_workflow` 로 하고, 그 후 `workflow.ts` 를 동기화 커밋한다.
- **n8n MCP 사용 순서(생략 금지)**: `get_sdk_reference` → 관련 `get_workflow_best_practices` →
  `search_nodes` → `get_node_types`(쓸 노드 전부, discriminator 포함) → 코드 작성 →
  `validate_workflow` → `update_workflow` → `execute_workflow`(manual)로 실데이터 검증.
  SDK 문법·파라미터명을 기억으로 추측하면 무효 워크플로우가 된다.
- **`public` 스키마는 읽기 전용.** SELECT 만, 항상 스키마 수식(`public."Lessons"`). PascalCase 컬럼은 큰따옴표.
- **대시보드 상태는 `automation` 스키마** = snake_case (`automation.trial_dashboard_state`).
  `pre_trial_call_checks BOOLEAN[3]`, `sales_note`, `updated_at TIMESTAMPTZ`.
- **DDL·프로덕션 쓰기는 Claude 가 직접 실행하지 않는다.** DB 소유자가 실행하고, 워크플로우는 테이블 존재를 가정한다.
- Postgres 자격증명: `automation_coupons` (id `TYGrEaGEtyIrZUHe`, DB `naonow` 프로덕션). 읽기 검증은 임시 워크플로우로 하고 실행 후 아카이브.
- n8n 체인 패턴: `Webhook(responseMode: responseNode) → Postgres(executeQuery) → respondToWebhook`.
  파라미터는 `options.queryReplacement` 에 **배열 표현식** `={{ [$json...] }}` (콤마 split 회피 — note 텍스트 안전).
- n8n 인증은 현재 `none` → **배포 전 x-api-key(Header Auth) 추가** 필요.
- 검증된 스키마 사실: status enum 은 `canceled`(l 하나) · `Mentors` 는 `firstName/lastName/tier/gender`(단일 `name` 없음) ·
  학생 이름은 `Students.firstName+lastName` → 없으면 `koreanEquivalent` · `CallQueues.studentId` 로 조인 ·
  `converted = lifecycle='converted' OR purchasedAt IS NOT NULL` · sales rep 표시명은 `Users.email` local-part(임시).

# 현재 계약 drift (작업 시 반드시 인지)

계약(`docs/contract/`)은 갱신됐지만 `src/**` 는 아직 구버전이다. 프론트 반영 목록은
[docs/contract/api-contract.md](../docs/contract/api-contract.md) 의 체크리스트가 SoT:

- `src/types/trial.ts` — `precheck_1/2/3` → `pre_trial_call_checks: boolean[]`, `student_name` 추가,
  `pre_call_done`/`post_call_done`/`call_queue_url` 제거 (백엔드에서 이미 스코프 아웃).
- 라우트 폴더 `src/app/api/trials/precheck/` → `pre-trial-call-check/`, `savePrecheck` → `savePreTrialCallCheck`.
- `computeStats`(`features/trials/lib/aggregate.ts`) 의 pre/post-call 필드 및 StatCards 두 타일 제거.

요청/응답 모양을 바꿀 때는 **openapi.yaml 을 먼저 고치고** n8n 과 프론트가 각자 수렴한다.
