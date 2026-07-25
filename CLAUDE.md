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
| 프론트 | n8n | 메서드 | body |
|---|---|---|---|
| `/api/trials` | `/webhook/trials` | GET | — |
| `/api/trials/{id}` | `/webhook/<hookId>/trials/<id>` | GET | — |
| `/api/trials/{id}/pre-trial-call-check` | `/webhook/<hookId>/trials/<id>/pre-trial-call-check` | PATCH | `{stage, checked}` |
| `/api/trials/{id}/note` | `/webhook/<hookId>/trials/<id>/note` | PATCH | `{note}` |

**`trial_id` 는 경로에만 있다 — 요청 body 에 없다**(양쪽 모두). 응답에는 에코로 들어온다.
`<hookId>` = **엔드포인트마다 다른** n8n Webhook 노드의 `webhookId`(UUID). 경로에 동적 값(`:trial_id`)이
있으면 n8n 이 이 UUID 를 경로 앞에 강제로 붙인다 → `src/lib/n8n.ts` 의 `n8nPaths` 가 `N8N_WEBHOOK_ID_*`
env 3개로 주입받아 흡수한다. **목록만 동적 값이 없어 UUID 가 붙지 않는다**(n8n UI 실측).

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

- `automation.trial_dashboard_state` **생성 완료**(2026-07-26 실행 1181101 로 확인 — 이 테이블을
  LEFT JOIN 하는 목록 쿼리가 에러 없이 실제 행을 반환). 이전의 "존재 X → 4 엔드포인트 전부 500" 은 해소됐다.
  ⚠ FK 는 없다(`ddl.sql` 참고) → 존재하지 않는 `trial_id` 를 DB 가 막지 않으므로 쓰기 쿼리가 직접 막는다.
- 워크플로우 **발행됨**(2026-07-26): `active: true`, trigger 4개. production URL 서빙 중.
  실제 요청으로 확인한 것 — 목록 `GET /webhook/trials` **200**, 상세 `GET /webhook/<hookId>/trials/<id>` **200**,
  없는 id 는 **404 `{"error":"Trial not found"}`**(IF `loose` 수정이 실제로 동작함), 정렬 DESC.
  **목록에 webhookId 는 붙지 않는다** — `/webhook/<uuid>/trials` 는 404 `not registered` 로 확정.
  ⚠ MCP `get_workflow_details` 의 triggerInfo 는 **항상** `<webhookId>/<path>` 로 표시하므로 URL 판별 근거로 쓰지 말 것.
- **인증 `none` — 의도적 보류(2026-07-26 결정).** 팀 내부 MVP 시연으로 사용 승인을 먼저 받는 것이
  목표이므로 그때까지 인증을 붙이지 않는다. **실수가 아니므로 다시 제기하지 말 것.**
  단 전제는 알고 있어야 한다: PII(학생 이름·이메일·휴대폰번호) 전부를 담은 **목록만 UUID 가 없어**
  `https://naonowadmin.app.n8n.cloud/webhook/trials` 로 호스트만 알면 열린다(나머지 3개는 UUID 로 가려짐).
  → **승인 후 롤아웃 전 필수 작업**: Webhook 노드 4개에 Header Auth(`x-api-key`) 부착.
  프록시(`src/lib/n8n.ts`)는 `N8N_API_TOKEN` 으로 이미 헤더를 붙이고 있어 n8n 쪽만 켜면 된다.
- **타임존 (2026-07-25 수정 완료·배포됨)**: `Lessons.startAt` 은 `timestamp without time zone` 인데
  **값은 UTC** 다. 확정 근거(추론 아님): 타임존 명시 컬럼과 31,567행 대조 —
  `automation.paid_class_reminder_log.class_start_at` 28,784/28,791 일치,
  `automation.phase1_lifecycle.trial_scheduled_at` 2,776/2,776 일치, **KST 가정은 양쪽 0건**.
  보조 근거: trial 시작 시각 분포가 naive+9h 에서 15–21시 KST 로 몰린다(naive 그대로면 저녁이 텅 빔).
  naive 값에 `AT TIME ZONE 'Asia/Seoul'` 을 바로 걸면 공식 문서대로 "이 값이 서울 시각"이라 **가정**해
  9시간을 빼므로 **18시간 오차**가 났다. 수정 후 규칙은 하나다: **naive(UTC) + 9h = KST 벽시계.**
  오늘 창은 반열린 구간 `[KST 오늘 00:00, 내일 00:00)` 을 naive-UTC 로 표현해 `startAt` 인덱스를 살린다
  (`Lessons_mentorId_isMock_status_startAt_idx` 사용, Bitmap Index Scan 6.85ms vs 컬럼을 감쌀 때 Seq Scan 27ms).
  ⚠ `(startAt AT TIME ZONE 'Asia/Seoul')::date` 류는 **클라이언트 세션 TimeZone 에 따라 결과가 달라진다** —
  psql(UTC)과 GUI(Asia/Seoul)에서 다른 행이 나오므로 수동 테스트 근거로 쓰지 말 것.
- distinct 실측: `Mentors.tier` = `elite, normal`(**`basic` 없음**) · `Mentors.gender` = `female, male, nonbinary` ·
  trial 의 `Lessons.status` = `approved, canceled, completed, paid`(`scheduled` 는 trial 행에 없음).
- 그 외: 학생 이름은 `Students.firstName+lastName` → 없으면 `koreanEquivalent` · `CallQueues.studentId` 로 조인 ·
  `converted = lifecycle='converted' OR purchasedAt IS NOT NULL` · sales rep 표시명은 `Users.email` local-part(임시).

# 계약 정합 상태

이 브랜치의 코드·mock·스펙은 서로 일치한다(`pnpm test:contract` 통과, mock/라이브 모두).
**남은 drift 는 `frontend` 브랜치 쪽**이며 할 일 목록은 [docs/contract/api-contract.md](docs/contract/api-contract.md) 가 SoT다.
요청/응답 모양을 바꿀 때는 **openapi.yaml 을 먼저 고치고** n8n·프론트가 각자 수렴한다.
