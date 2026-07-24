# Backend Data Layer — Today-Trials Dashboard

> 대상 브랜치: `backend`. 프론트(`trial-dashboard`)가 `/api/*` 로 요청 →
> n8n webhook → GCP Cloud SQL(Postgres) 로 내려가는 **데이터 로직의 단일 설계서**.
> 실제 DB 스키마 근거: `../n8n-workflows/docs/schema/public/*.md`.
> ⚠ 프로덕션 DB 대상 DDL/쿼리이므로 **실행 전 소유자(Denise/DB) 확인**이 필요한 항목은 `VERIFY`/`DECISION`으로 표시.

---

## 0. 레포 배치
- **프론트 + 계약/타입 + Route Handler**: `trial-dashboard` (이 레포, `backend` 브랜치).
- **n8n 워크플로우(webhook + Postgres 노드) 실체**: `../n8n-workflows/workflows/trials-api/` (git 미추적).
  이 문서의 SQL/DDL 이 배포 원본이며, n8n 노드에 그대로 투입한다.

---

## 1. 데이터 소스 (실제 테이블)

| 논리 필드 | 출처 컬럼 | 비고 |
|---|---|---|
| trial_id | `"Lessons".id` | `isTrial = TRUE` 인 행만 |
| trial_time / trial_date | `"Lessons"."startAt"` | KST 로 변환 |
| status | `"Lessons".status` | `"LessonStatusType"` — VERIFY 철자(§4) |
| student_id | `"Students".id` | |
| level | `"Students".level` (+ `"langLevel"`) | `"3 · Beginner-High"` 조합 |
| student_email | `"Users".email` | `Students.userId → Users` |
| student_phone_number | `"Users"."phoneNumber"` | |
| mentor_id | `"Lessons"."mentorId"` | |
| mentor_name | `"CalendlyEvents"."mentorName"`(스냅샷) → `"Mentors"` | VERIFY Mentors 스키마 |
| mentor_tier | `"Mentors".tier` (`"MentorTier"` elite\|basic) | VERIFY |
| mentor_gender | `"Mentors".gender` (`"GenderType"`) | VERIFY |
| sales_rep_name | `"CallQueues"."claimedByAdminId"` / `"autoAssignedToId"` → `"Users"`(admin) | VERIFY admin 표시명 소스(§4) |
| interests | `"CallQueues"."answersJson"->'interests'` | 온보딩 설문 JSONB |
| converted | `"CallQueues".lifecycle='converted' OR "purchasedAt" IS NOT NULL` | |
| **precheck_1/2/3** | **신규 `sales."TrialDashboardState"`** | §2 — DB에 저장처 없음 |
| **pre/post_call_done** | **신규 `sales."TrialDashboardState"`** | §2 — 판정기준 DECISION(§4) |
| **sales_note(학생 추가정보)** | **신규 `sales."TrialDashboardState"."salesNote"`** | §2 — 사용자 요청 신규 |

---

## 2. 스키마 설계 (신규) — 대시보드 전용 상태 테이블

precheck·call-done·세일즈 메모는 **기존 core 테이블에 저장처가 없다**. core 테이블
(`Lessons`/`CallQueues`)을 오염시키지 않도록, 대시보드가 소유하는 **단일 상태 테이블**을
별도 스키마(`sales`)에 둔다. 마이그레이션 1회로 precheck + call-done + 추가정보를 모두 커버.

```sql
-- DECISION: 스키마명 sales / 테이블명 TrialDashboardState (합의 필요)
CREATE SCHEMA IF NOT EXISTS sales;

CREATE TABLE IF NOT EXISTS sales."TrialDashboardState" (
    "lessonId"     INTEGER PRIMARY KEY
                   REFERENCES "Lessons"(id) ON UPDATE CASCADE ON DELETE CASCADE,
    "precheck1"    BOOLEAN      NOT NULL DEFAULT FALSE,
    "precheck2"    BOOLEAN      NOT NULL DEFAULT FALSE,
    "precheck3"    BOOLEAN      NOT NULL DEFAULT FALSE,
    "preCallDone"  BOOLEAN      NOT NULL DEFAULT FALSE,
    "postCallDone" BOOLEAN      NOT NULL DEFAULT FALSE,
    "salesNote"    TEXT,                          -- 학생 관련 추가 정보 / 세일즈 메모(자유서술)
    "updatedBy"    INTEGER REFERENCES "Users"(id),-- 조작한 admin
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**설계 근거**
- `lessonId` PK → trial 1건당 상태 1행. upsert(`ON CONFLICT`)로 단순.
- core 테이블 무변경 → 프로덕션 리스크 최소, 롤백은 테이블 drop 한 번.
- `updatedBy`/`updatedAt` 로 최소 감사 이력.

**대안 (DECISION)**
- (A) *권장* — 위 단일 상태 테이블 + `salesNote` 자유서술 1필드.
- (B) 세일즈 메모를 **이력(스레드)** 로 남기려면 기존 `"CallQueueNotes"(type='sales', content, lessonId, createdById)` 재사용 → DDL 불필요, 대신 조회 조인 추가. precheck/flag 는 여전히 (A) 테이블 필요.
- → **추가 정보를 "덮어쓰는 한 줄"로 볼지 "쌓이는 메모"로 볼지** 확정 필요.

---

## 3. 쿼리 (엔드포인트별)

컬럼명은 camelCase + 큰따옴표 필수. n8n Postgres 노드에 파라미터라이즈드로 투입.

### 3.1 GET `/webhook/trials/today` — 오늘의 trial 목록
```sql
WITH kst_today AS (
  SELECT (now() AT TIME ZONE 'Asia/Seoul')::date AS d
)
SELECT
  l.id::text                                                        AS trial_id,
  to_char(l."startAt" AT TIME ZONE 'Asia/Seoul',
          'YYYY-MM-DD"T"HH24:MI:SS') || '+09:00'                    AS trial_time,
  s.id::text                                                        AS student_id,
  u.email                                                           AS student_email,
  u."phoneNumber"                                                   AS student_phone_number,
  COALESCE(ce."mentorName", m.name)                                 AS mentor_name,      -- VERIFY Mentors.name
  m.tier                                                            AS mentor_tier,      -- VERIFY "MentorTier"
  COALESCE(rep_name.display, '—')                                   AS sales_rep_name,   -- VERIFY(§4)
  l.status                                                          AS status,
  COALESCE(d."precheck1", FALSE)                                    AS precheck_1,
  COALESCE(d."precheck2", FALSE)                                    AS precheck_2,
  COALESCE(d."precheck3", FALSE)                                    AS precheck_3,
  COALESCE(d."preCallDone", FALSE)                                  AS pre_call_done,
  COALESCE(d."postCallDone", FALSE)                                 AS post_call_done,
  (cq.lifecycle = 'converted' OR cq."purchasedAt" IS NOT NULL)      AS converted
FROM "Lessons" l
JOIN kst_today t
  ON (l."startAt" AT TIME ZONE 'Asia/Seoul')::date = t.d
JOIN "Students" s ON s.id = l."studentId"
JOIN "Users"    u ON u.id = s."userId"
LEFT JOIN "Mentors" m ON m.id = l."mentorId"                        -- VERIFY 조인키/컬럼
LEFT JOIN LATERAL (                                                 -- 예약 당시 멘토 스냅샷
  SELECT ce."mentorName"
  FROM "CalendlyEvents" ce
  WHERE ce."studentId" = s.id AND ce."mentorId" = l."mentorId"
  ORDER BY ce."startAt" DESC
  LIMIT 1
) ce ON TRUE
LEFT JOIN "CallQueues" cq ON cq."studentId" = s.id                  -- VERIFY studentId vs userId
LEFT JOIN LATERAL (                                                 -- sales rep 표시명 (§4 VERIFY)
  SELECT ru.email AS display                                       --  임시: email; 실제 이름 소스 확정 시 교체
  FROM "Users" ru
  WHERE ru.id = COALESCE(cq."claimedByAdminId", cq."autoAssignedToId")
) rep_name ON TRUE
LEFT JOIN sales."TrialDashboardState" d ON d."lessonId" = l.id
WHERE l."isTrial" = TRUE
ORDER BY l."startAt";
```
- **오늘 필터**: `startAt` 을 KST 로 캐스팅해 오늘 날짜와 비교 (PRD §7.1 "서버가 KST 기준").
- **취소 포함 여부 (DECISION)**: 현재 status 필터 없음 → 취소 trial 도 표시(mock 과 동일). 숨길지 정책 확정.
- n8n 은 이 결과 배열을 `{ "trials": [...] }` 로 감싸 반환.

### 3.2 GET `/webhook/trials/detail?trial_id=<id>` — 단건 상세
```sql
SELECT
  l.id::text                                             AS trial_id,
  s.id::text                                             AS student_id,
  u.email                                                AS student_email,
  u."phoneNumber"                                        AS student_phone_number,
  s.level::text || COALESCE(' · ' || s."langLevel", '')  AS level,
  m.id::text                                             AS mentor_id,
  COALESCE(ce."mentorName", m.name)                      AS mentor_name,
  m.gender::text                                         AS mentor_gender,     -- VERIFY "GenderType"
  COALESCE(cq."answersJson"->'interests', '[]'::jsonb)   AS interests,         -- JSONB 배열
  to_char(l."startAt" AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS trial_date,
  d."salesNote"                                          AS sales_note         -- 신규: 학생 추가정보
FROM "Lessons" l
JOIN "Students" s ON s.id = l."studentId"
JOIN "Users"    u ON u.id = s."userId"
LEFT JOIN "Mentors" m ON m.id = l."mentorId"
LEFT JOIN LATERAL (
  SELECT ce."mentorName" FROM "CalendlyEvents" ce
  WHERE ce."studentId" = s.id AND ce."mentorId" = l."mentorId"
  ORDER BY ce."startAt" DESC LIMIT 1
) ce ON TRUE
LEFT JOIN "CallQueues" cq ON cq."studentId" = s.id
LEFT JOIN sales."TrialDashboardState" d ON d."lessonId" = l.id
WHERE l.id = $1::int;   -- $1 = trial_id
```
- `interests` 는 JSONB 배열 그대로 반환 → 프론트 `string[]`.
- `call_queue_url` 은 **폐기**(PRD §7.2 개정). CloudTalk `ct+tel:` 로 대체됨.

### 3.3 PATCH `/webhook/trials/precheck` — precheck 저장 (upsert)
```sql
-- $1=trial_id(int), $2=stage(1|2|3), $3=checked(bool), $4=updatedBy(admin id, nullable)
INSERT INTO sales."TrialDashboardState" AS d
  ("lessonId","precheck1","precheck2","precheck3","updatedBy")
VALUES ($1,
  CASE WHEN $2=1 THEN $3 ELSE FALSE END,
  CASE WHEN $2=2 THEN $3 ELSE FALSE END,
  CASE WHEN $2=3 THEN $3 ELSE FALSE END,
  $4)
ON CONFLICT ("lessonId") DO UPDATE SET
  "precheck1" = CASE WHEN $2=1 THEN $3 ELSE d."precheck1" END,
  "precheck2" = CASE WHEN $2=2 THEN $3 ELSE d."precheck2" END,
  "precheck3" = CASE WHEN $2=3 THEN $3 ELSE d."precheck3" END,
  "updatedBy" = $4,
  "updatedAt" = now()
RETURNING d."lessonId"::text AS trial_id, $2 AS stage, $3 AS checked;
-- n8n: { ok: true, trial_id, stage, checked } 로 매핑
```

### 3.4 PATCH `/webhook/trials/note` — 학생 추가정보/세일즈 메모 저장 (신규, upsert)
```sql
-- $1=trial_id(int), $2=note(text), $3=updatedBy(admin id, nullable)
INSERT INTO sales."TrialDashboardState" AS d ("lessonId","salesNote","updatedBy")
VALUES ($1, $2, $3)
ON CONFLICT ("lessonId") DO UPDATE SET
  "salesNote" = EXCLUDED."salesNote",
  "updatedBy" = $3,
  "updatedAt" = now()
RETURNING d."lessonId"::text AS trial_id, d."salesNote" AS note;
```
> 대안 (B) 채택 시: `INSERT INTO "CallQueueNotes"(...)` 로 이력 append + detail 에서 최근 노트 조회.

---

## 4. 가정 & 검증 항목 (구현 전 확정 필요)

| # | 항목 | 현재 처리 | 확정 방법 |
|---|---|---|---|
| V1 | `status` enum 철자 `canceled`(L1) vs `cancelled`(L2) | 필터 안 함(전량 표시) | `SELECT unnest(enum_range(NULL::"LessonStatusType"));` |
| V2 | `"Mentors"` 스키마(문서 없음): `name`/`tier`/`gender` 컬럼·조인키 | `Mentors.name/tier/gender` 가정 | 라이브 `\d "Mentors"` |
| V3 | `sales_rep_name` 실제 이름 소스 (`Users` 에 이름 컬럼 없음) | 임시 `Users.email` | admin 프로필/`SalesRepConfigs` 확인 |
| V4 | `CallQueues` 조인키 `studentId` vs `userId` | `studentId` 가정 | 라이브 확인 |
| V5 | `pre_call_done`/`post_call_done` **판정 기준** | 신규 테이블 수동 플래그로 취급 | 파생(Activities/salesStage)인지 수동인지 DECISION |
| V6 | `converted` 기준 | `lifecycle='converted' OR purchasedAt IS NOT NULL` | 확인 |
| V7 | 취소 trial 목록 포함 여부 | 포함 | DECISION |
| D1 | 신규 스키마/테이블 명, 생성 권한 | `sales."TrialDashboardState"` 제안 | 소유자 승인(프로덕션 DDL) |
| D2 | 추가정보 = 덮어쓰기(A) vs 이력(B) | (A) 단일 `salesNote` | DECISION |

---

## 5. API 계약 변경 (PRD §7·§8 대비 delta)
- `TrialDetail` 에 `sales_note?: string` 추가, `call_queue_url` 제거(개정 반영).
- **신규 엔드포인트**: 프론트 `PATCH /api/trials/note` → n8n `PATCH /webhook/trials/note`.
  body `{ trial_id, note }`, 200 `{ ok, trial_id, note }`.
- Route Handler 는 기존 3개와 동일 패턴(x-api-key 부착, no-store, mock 폴백)으로 추가.

## 6. 구현 순서 (backend 브랜치)
1. (이 문서) 스키마·쿼리 설계 확정 ← **현재. V/D 항목 사용자 확인 대기.**
2. 타입/계약 갱신(`types/trial.ts`: `sales_note`, note 요청/응답) — 프론트 파일 충돌 최소화(additive).
3. Route Handler `note` 추가 + mock 확장(`setMockNote`).
4. n8n 워크플로우 4개(today/detail/precheck/note) 구축 — `../n8n-workflows/workflows/trials-api/` + 위 SQL 투입.
5. env 연결(`N8N_BASE_URL`/`TOKEN`) → mock 해제, end-to-end 검증.
