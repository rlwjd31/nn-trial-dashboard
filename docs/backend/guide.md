# Backend Domain Guide — Trials API (n8n + DB)

> 백엔드 도메인(오늘의 trial 데이터) 작업 규칙. 프론트 도메인과 분리된다.
> 공유 계약은 [../contract/openapi.yaml](../contract/openapi.yaml) · [../contract/api-contract.md](../contract/api-contract.md).
> 이 폴더의 나머지: [data-layer.md](./data-layer.md)(쿼리·스키마 설계), [ddl.sql](./ddl.sql), [workflow.ts](./workflow.ts)(배포본 동기 SDK).

## 1. 경계 & 소유권
- **백엔드 = n8n 워크플로우 + DB.** 프론트(`src/**`)는 건드리지 않는다.
- **배포 SoT = n8n 클라우드 워크플로우** "[Trial API] - Main" (id `OHSTgJsHd6337qgf`, project Nao Now). `workflow.ts`는 그 *기록 사본*이지 배포 수단이 아니다 — 실제 변경은 n8n MCP `update_workflow`로.
- **계약 우선(contract-first)**: 응답/요청 모양을 바꿀 땐 `../contract/openapi.yaml` 을 먼저 고치고, n8n과 프론트가 각자 수렴.

## 2. DB 규칙 (가장 중요)
- **`public` 스키마 = 읽기 전용. 절대 변경 금지.** SELECT 만. 항상 **스키마 수식**: `public."Lessons"`, `public."Users"` …
- **대시보드 상태는 `automation` 스키마**에 둔다. 네이밍은 그 스키마 컨벤션 = **snake_case** (`automation.trial_dashboard_state`, `pre_trial_call_checks`). date 타입은 이 테이블만 **timestamptz**(멀티 타임존).
- **DDL/테이블 생성은 DB 소유자가 실행한다. Claude 는 프로덕션 DDL·쓰기를 직접 실행하지 않는다.** `ddl.sql` 은 "이렇게 만들라"는 스펙이고, "테이블이 있다고 가정"하고 쿼리/워크플로우를 짠다.
- **Postgres 자격증명**: `automation_coupons` (id `TYGrEaGEtyIrZUHe`) = DB `naonow`(프로덕션). 읽기 검증은 임시 워크플로우로 하고 실행 후 아카이브.

## 3. n8n 워크플로우 구조
엔드포인트당 체인: `Webhook(responseNode) → Postgres(executeQuery) → respondToWebhook(JSON)`.
- 목록은 `→ Aggregate(trials) → Respond`, 상세는 `→ IF(found) → Respond/404`.
- 파라미터라이즈드 쿼리: `options.queryReplacement` 에 **배열 표현식** `={{ [$json...] }}`(콤마 split 문제 회피). 텍스트에 콤마 있는 note 도 안전.
- 인증: 현재 `authentication: none`. **배포 전 x-api-key(Header Auth) 추가**(PRD: 개인정보 게이트).

## 4. 검증된 스키마 사실 (라이브 확인, 2026-07-24)
- `LessonStatusType` = `{scheduled,in_progress,canceled,completed,paid,approved,rescheduled}` → **취소는 `canceled`(L1)**.
- `Mentors`: `firstName,lastName,tier(MentorTier),gender`. 단일 `name` 없음.
- 학생 이름: `Students.firstName+lastName`, 없으면 `koreanEquivalent`.
- `CallQueues.studentId` 로 조인(LATERAL 최신 1건). `converted = lifecycle='converted' OR purchasedAt IS NOT NULL`.
- sales rep 표시명: `Users` 에 이름 컬럼 없음 → email local-part 로 대체(추후 확정).
- ⚠ **타임존 미해결**: `startAt`(timestamp-without-tz)의 KST 변환식이 UTC 저장이면 어긋날 수 있음 → 실데이터로 확인 후 SELECT 변환만 보정(§ data-layer 참고). public 은 여전히 읽기만.

## 5. 작업 절차
1. 계약(openapi) 확인/갱신 → 2. n8n MCP 로 워크플로우 수정 → 3. `update_workflow` 후 `execute_workflow`(manual)로 실데이터 검증 → 4. `workflow.ts`·`ddl.sql`·docs 동기화 커밋 → 5. 계약 변경분은 프론트에 handoff([../contract/api-contract.md](../contract/api-contract.md)).
