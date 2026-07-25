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

### 4-1. distinct 실측값 (2026-07-25)
| 컬럼 | 실제 값 | 비고 |
|---|---|---|
| `Mentors.tier` | `elite`, `normal` | 구 스펙의 `basic` 은 **존재하지 않음** |
| `Mentors.gender` | `female`, `male`, `nonbinary` | |
| `Lessons.status` (isTrial=TRUE) | `approved`, `canceled`, `completed`, `paid` | trial 행에 `scheduled` 없음 |
| `Students.level` | `1` (단일값) | 표시용 `level` 은 `level + langLevel` 조합 |

### 4-2. 타임존 — **수정 완료·배포됨** (2026-07-25)

`Lessons.startAt` 은 `timestamp without time zone` 인데 **값은 UTC** 다.

**확정 근거** — 타임존이 명시된(`timestamptz`) 컬럼과 같은 lesson 을 31,567행 대조:

| 대조 대상 | 비교 행 | `startAt`=UTC 가정 | `startAt`=KST 가정 |
|---|---|---|---|
| `automation.paid_class_reminder_log.class_start_at` | 28,791 | **28,784** | **0** |
| `automation.phase1_lifecycle.trial_scheduled_at` | 2,776 | **2,776** | **0** |

보조 근거: 최근 30일 trial 시작 시각 분포가 `naive+9h` 에서 15–21시 KST 로 몰린다
(naive 를 그대로 KST 로 읽으면 저녁 시간대가 거의 0 이라 서비스 실태와 안 맞는다).

**무엇이 틀렸었나** — naive 값에 `AT TIME ZONE 'Asia/Seoul'` 을 바로 걸면 PostgreSQL 은 문서대로
("assuming the given value is in the named time zone") 그 값을 **서울 시각으로 가정**해 9시간을
**뺀다.** 거기에 문자열 `+09:00` 을 붙여서 표시 **18시간 오차** + 오늘 창 밀림이 났다.

**규칙은 하나: `naive(UTC) + 9h = KST 벽시계.`** 적용된 형태:
```sql
to_char(l."startAt" + interval '9 hours', 'YYYY-MM-DD"T"HH24:MI:SS') || '+09:00'  -- trial_time
to_char(l."startAt" + interval '9 hours', 'YYYY-MM-DD')                            -- trial_date
-- 오늘 창: [KST 오늘 00:00, 내일 00:00) 반열린 구간
AND l."startAt" >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') - interval '9 hours'
AND l."startAt" <  date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') - interval '9 hours' + interval '1 day'
```
- `Asia/Seoul` 은 고정 UTC+9·DST 없음(`pg_timezone_names` 확인) → `+9h` 산술과
  `AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul'` 은 **동일 값**(실측). 짧은 쪽을 쓴다.
- **컬럼을 함수로 감싸지 말 것.** 감싸면 `Lessons_mentorId_isMock_status_startAt_idx` 를 못 쓴다:
  Bitmap Index Scan **6.85ms** → Parallel Seq Scan **27ms** (EXPLAIN ANALYZE 실측, 26.7만 행).
- SELECT 변환만 바꿨고 `public` 은 여전히 읽기 전용이다.

⚠ **수동 테스트 함정**: `(startAt AT TIME ZONE 'Asia/Seoul')::date` 류는 결과가
**클라이언트 세션 TimeZone 에 따라 달라진다**(psql=UTC vs GUI=Asia/Seoul). 게다가 반환된 raw
`startAt` 값은 UTC 라서 로컬 시각처럼 읽으면 "맞아 보인다". 검증 근거로 쓰지 말 것.

### 4-3. 현재 블로커
1. **`automation.trial_dashboard_state` 없음** → LEFT JOIN 이라도 쿼리 전체 실패 → 4 엔드포인트 전부 500.
   `ddl.sql` 을 DB 소유자가 실행해야 해제된다. (상태 테이블 조인만 빈 관계로 치환하면 나머지 SQL 은 정상 동작 확인)
2. 워크플로우 **미발행**(`active: false`) → production webhook URL 미서빙.
3. 웹훅 인증 `none` → 발행 전 `x-api-key`(Header Auth) 필요.

## 5. 작업 절차
1. 계약(openapi) 확인/갱신 → 2. n8n MCP 로 워크플로우 수정 → 3. `update_workflow` 후 `execute_workflow`(manual)로 실데이터 검증 → 4. `workflow.ts`·`ddl.sql`·docs 동기화 커밋 → 5. 계약 변경분은 프론트에 handoff([../contract/api-contract.md](../contract/api-contract.md)).
