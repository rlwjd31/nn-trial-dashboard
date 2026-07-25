// n8n Workflow SDK — Trials API (cloud n8n: naonowadmin.app.n8n.cloud)
// 배포 대상: 워크플로우 "[Trial API] - Main" (id OHSTgJsHd6337qgf). 이 파일은 배포본과 동기 유지.
// 4 webhook 엔드포인트 → Postgres(executeQuery) → respondToWebhook(JSON).
//
// 경로는 REST 형태 (2026-07-25 변경): trials · trials/:trial_id ·
//   trials/:trial_id/pre-trial-call-check · trials/:trial_id/note.
// ⚠ 경로에 동적 값(:trial_id)이 있으면 n8n 이 **노드별 webhookId 를 경로 앞에 강제로 붙인다**
//   (Webhook 노드 문서: "If dynamic values are set 'webhookId' would be prepended to path").
//   → 실제 URL 은 https://naonowadmin.app.n8n.cloud/webhook/<webhookId>/trials/... 이고
//     webhookId 는 엔드포인트마다 다르다. 프록시는 이를 N8N_WEBHOOK_ID_* env 로 주입받는다.
//   반대로 목록(path 'trials')은 동적 값이 없어 UUID 가 붙지 않는다 → /webhook/trials (UI 실측).
//   현재 값: detail=9c35b3bd-5332-4c96-a987-0c02c7a2f7e3 ·
//     pre-trial-call-check=e54c6e9b-47f3-43df-b6db-e6d4c6592bc4 ·
//     note=4c3ebf05-0d6b-4085-a774-3aa189028774
// trial_id 는 경로 파라미터이므로 노드에서 `$json.params.trial_id` 로 읽는다(body/query 아님).
//
// 네이밍 컨벤션:
//  - public 원천 테이블: PascalCase 따옴표 (public."Lessons" 등) — 기존 스키마 그대로.
//  - 신규 상태 테이블: automation.trial_dashboard_state (snake_case, automation 스키마 컨벤션).
// 전제:
//  - automation.trial_dashboard_state 존재 (ddl.sql — DB 소유자가 생성).
//  - Postgres 자격증명 id=TYGrEaGEtyIrZUHe (automation_coupons, DB=naonow prod).
//  - 인증은 현재 none. 배포 전 x-api-key(Header Auth) 추가 권장.
//
// 확정 스키마 사실(라이브 검증):
//  - status enum: canceled(L1). Mentors: firstName/lastName/tier/gender.
//  - CallQueues.studentId 로 조인. sales_rep_name: Users 이름 컬럼 없음 → email local-part.
//  - 스코프: precheck_1/2/3 + sales_note. (pre/post_call_done 제외 — 구현 불요)

import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const PG = { postgres: { id: 'TYGrEaGEtyIrZUHe', name: 'automation_coupons' } };

const todayWebhook = trigger({
  type: 'n8n-nodes-base.webhook', version: 2.1,
  config: { name: 'Today Webhook', parameters: { httpMethod: 'GET', path: 'trials', responseMode: 'responseNode', options: {} } }
});
const detailWebhook = trigger({
  type: 'n8n-nodes-base.webhook', version: 2.1,
  // path 앞의 슬래시는 배포본 그대로다(나머지 3개는 없다). n8n 이 정규화해 URL 은 동일하다.
  config: { name: 'Detail Webhook', parameters: { httpMethod: 'GET', path: '/trials/:trial_id', responseMode: 'responseNode', options: {} } }
});
const precheckWebhook = trigger({
  type: 'n8n-nodes-base.webhook', version: 2.1,
  config: { name: 'Pre-trial Call Check Webhook', parameters: { httpMethod: 'PATCH', path: 'trials/:trial_id/pre-trial-call-check', responseMode: 'responseNode', options: {} } }
});
const noteWebhook = trigger({
  type: 'n8n-nodes-base.webhook', version: 2.1,
  config: { name: 'Note Webhook', parameters: { httpMethod: 'PATCH', path: 'trials/:trial_id/note', responseMode: 'responseNode', options: {} } }
});

// Route 1: GET /trials  (목록)
// 타임존 계산은 SQL 밖에서 한다(2026-07-26 변경). Lessons."startAt" 은 timestamp without time zone
// 인데 값이 UTC 라, KST 하루 경계를 매 쿼리마다 SQL 로 복원하면 읽기도 어렵고 틀리기도 쉽다.
// → Set 노드가 Luxon 으로 KST [오늘 00:00, 내일 00:00) 을 offset 포함 ISO 로 만들고,
//   쿼리는 $1/$2 를 timestamptz 로 파싱해 AT TIME ZONE 'UTC' 로 startAt 좌표계에 맞춘다.
//   컬럼을 감싸지 않으므로 startAt 인덱스는 그대로 쓴다.
// Date & Time 노드를 쓰면 경계 2개에 노드 2개(getCurrentDate + addToDate)가 필요하다 —
// 같은 Luxon 엔진이므로 Set 노드 하나로 통합했다(실행 1181101 로 동일 결과 확인).
const todayWindow = node({
  type: 'n8n-nodes-base.set', version: 3.4,
  config: { name: 'KST Day Window', parameters: { mode: 'manual', includeOtherFields: false, options: {},
    assignments: { assignments: [
      { id: 'a1f0c2d4-1111-4a11-9c11-0f1a2b3c4d51', name: 'kst_from', type: 'string',
        value: expr("{{ $now.setZone('Asia/Seoul').startOf('day').toISO() }}") },
      { id: 'a1f0c2d4-2222-4a22-9c22-0f1a2b3c4d52', name: 'kst_to', type: 'string',
        value: expr("{{ $now.setZone('Asia/Seoul').startOf('day').plus({ days: 1 }).toISO() }}") },
    ] } } }
});
const todayQuery = node({
  type: 'n8n-nodes-base.postgres', version: 2.6,
  config: { name: 'Query Today', credentials: PG, parameters: { resource: 'database', operation: 'executeQuery',
    options: { queryReplacement: expr('{{ [$json.kst_from, $json.kst_to] }}') },
    query: `SELECT
  l.id::text AS trial_id,
  to_char((l."startAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS') || '+09:00' AS trial_time,
  s.id::text AS student_id,
  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', s."firstName", s."lastName")), ''), s."koreanEquivalent", '') AS student_name,
  u.email AS student_email,
  u."phoneNumber" AS student_phone_number,
  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', m."firstName", m."lastName")), ''), '') AS mentor_name,
  m.tier::text AS mentor_tier,
  COALESCE(split_part(rep.email, '@', 1), '') AS sales_rep_name,
  l.status::text AS status,
  COALESCE(d.pre_trial_call_checks, ARRAY[false,false,false]::boolean[]) AS pre_trial_call_checks,
  (cq.lifecycle = 'converted' OR cq."purchasedAt" IS NOT NULL) AS converted
FROM public."Lessons" l
JOIN public."Students" s ON s.id = l."studentId"
JOIN public."Users" u ON u.id = s."userId"
LEFT JOIN public."Mentors" m ON m.id = l."mentorId"
LEFT JOIN LATERAL (
  SELECT cq.* FROM public."CallQueues" cq WHERE cq."studentId" = s.id ORDER BY cq."updatedAt" DESC LIMIT 1
) cq ON TRUE
LEFT JOIN public."Users" rep ON rep.id = COALESCE(cq."claimedByAdminId", cq."autoAssignedToId")
LEFT JOIN automation.trial_dashboard_state d ON d.lesson_id = l.id
WHERE l."isTrial" = TRUE
  AND l."startAt" >= ($1::timestamptz AT TIME ZONE 'UTC')
  AND l."startAt" <  ($2::timestamptz AT TIME ZONE 'UTC')
ORDER BY l."startAt" DESC;` } }
});
const todayAggregate = node({
  type: 'n8n-nodes-base.aggregate', version: 1,
  config: { name: 'Wrap trials', parameters: { aggregate: 'aggregateAllItemData', destinationFieldName: 'trials', options: {} } }
});
const todayRespond = node({
  type: 'n8n-nodes-base.respondToWebhook', version: 1.5,
  config: { name: 'Respond Today', parameters: { respondWith: 'json', responseBody: expr('{{ $json }}'), options: { responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } } }
});

// Route 2: GET /trials/:trial_id  (상세)
const detailQuery = node({
  type: 'n8n-nodes-base.postgres', version: 2.6,
  config: { name: 'Query Detail', alwaysOutputData: true, credentials: PG,
    parameters: { resource: 'database', operation: 'executeQuery',
      options: { queryReplacement: expr('{{ [$json.params.trial_id] }}') },
      query: `SELECT
  l.id::text AS trial_id,
  s.id::text AS student_id,
  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', s."firstName", s."lastName")), ''), s."koreanEquivalent", '') AS student_name,
  u.email AS student_email,
  u."phoneNumber" AS student_phone_number,
  s.level::text || COALESCE(' · ' || s."langLevel", '') AS level,
  m.id::text AS mentor_id,
  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', m."firstName", m."lastName")), ''), '') AS mentor_name,
  m.gender::text AS mentor_gender,
  COALESCE(cq."answersJson"->'interests', '[]'::jsonb) AS interests,
  to_char((l."startAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS trial_date,
  d.sales_note AS sales_note
FROM public."Lessons" l
JOIN public."Students" s ON s.id = l."studentId"
JOIN public."Users" u ON u.id = s."userId"
LEFT JOIN public."Mentors" m ON m.id = l."mentorId"
LEFT JOIN LATERAL (
  SELECT cq.* FROM public."CallQueues" cq WHERE cq."studentId" = s.id ORDER BY cq."updatedAt" DESC LIMIT 1
) cq ON TRUE
LEFT JOIN automation.trial_dashboard_state d ON d.lesson_id = l.id
WHERE l.id = $1::int` }
  }
});
// typeValidation 은 'loose' 다(2026-07-26 변경). 행이 없으면 alwaysOutputData 로 `{}` 가 흘러
// $json.trial_id 가 undefined 인데, strict 였을 때는 IF 가 타입 에러로 죽어 404 분기를 못 탔다.
const detailFound = ifElse({
  version: 2.2,
  config: { name: 'Detail found?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, combinator: 'and', conditions: [{ leftValue: expr('{{ $json.trial_id }}'), rightValue: '', operator: { type: 'string', operation: 'notEmpty' } }] } } }
});
const detailRespond = node({
  type: 'n8n-nodes-base.respondToWebhook', version: 1.5,
  config: { name: 'Respond Detail', parameters: { respondWith: 'firstIncomingItem', options: { responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } } }
});
// Route 2·3·4 가 공유하는 404 응답 노드.
const detailNotFound = node({
  type: 'n8n-nodes-base.respondToWebhook', version: 1.5,
  config: { name: 'Respond 404', parameters: { respondWith: 'json', responseBody: expr('{{ { "error": "Trial not found" } }}'), options: { responseCode: 404, responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } } }
});

// Route 3: PATCH /trials/:trial_id/pre-trial-call-check  (단일 stage(1..3) 를 배열 요소로 upsert)
// ⚠ ddl.sql 은 public."Lessons" 로의 FK 를 두지 않는다(REFERENCES 권한 없음) → DB 가 존재하지 않는
//   trial_id 를 막아주지 않는다. 그래서 VALUES 대신 `SELECT ... FROM Lessons WHERE id = $1` 로 upsert 해
//   존재할 때만 쓰고, RETURNING 이 비면 IF 노드가 계약대로 404 를 낸다(고아 행 방지 겸용).
const precheckQuery = node({
  type: 'n8n-nodes-base.postgres', version: 2.6,
  config: { name: 'Upsert Pre-trial Call Check', alwaysOutputData: true, credentials: PG,
    parameters: { resource: 'database', operation: 'executeQuery',
      options: { queryReplacement: expr('{{ [$json.params.trial_id, $json.body.stage, $json.body.checked] }}') },
      query: `INSERT INTO automation.trial_dashboard_state AS d (lesson_id, pre_trial_call_checks)
SELECT l.id, ARRAY[
  ($2::int = 1 AND $3::boolean),
  ($2::int = 2 AND $3::boolean),
  ($2::int = 3 AND $3::boolean)
]::boolean[]
FROM public."Lessons" l
WHERE l.id = $1::int
ON CONFLICT (lesson_id) DO UPDATE SET
  pre_trial_call_checks[$2::int] = $3::boolean,
  updated_at = now()
RETURNING d.lesson_id::text AS trial_id` }
  }
});
const precheckFound = ifElse({
  version: 2.2,
  config: { name: 'Precheck found?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, combinator: 'and', conditions: [{ leftValue: expr('{{ $json.trial_id }}'), rightValue: '', operator: { type: 'string', operation: 'notEmpty' } }] } } }
});
const precheckRespond = node({
  type: 'n8n-nodes-base.respondToWebhook', version: 1.5,
  config: { name: 'Respond Pre-trial Call Check', parameters: { respondWith: 'json', responseBody: expr('{{ { "ok": true, "trial_id": $(\'Pre-trial Call Check Webhook\').item.json.params.trial_id, "stage": $(\'Pre-trial Call Check Webhook\').item.json.body.stage, "checked": $(\'Pre-trial Call Check Webhook\').item.json.body.checked } }}'), options: { responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } } }
});

// Route 4: PATCH /trials/:trial_id/note
// Route 3 과 같은 이유로 VALUES → SELECT FROM Lessons + RETURNING (FK 없음 → 404·고아 행 방지).
const noteQuery = node({
  type: 'n8n-nodes-base.postgres', version: 2.6,
  config: { name: 'Upsert Note', alwaysOutputData: true, credentials: PG,
    parameters: { resource: 'database', operation: 'executeQuery',
      options: { queryReplacement: expr('{{ [$json.params.trial_id, $json.body.note] }}') },
      query: `INSERT INTO automation.trial_dashboard_state AS d (lesson_id, sales_note)
SELECT l.id, NULLIF($2, '')
FROM public."Lessons" l
WHERE l.id = $1::int
ON CONFLICT (lesson_id) DO UPDATE SET
  sales_note = NULLIF($2, ''),
  updated_at = now()
RETURNING d.lesson_id::text AS trial_id` }
  }
});
const noteFound = ifElse({
  version: 2.2,
  config: { name: 'Note found?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, combinator: 'and', conditions: [{ leftValue: expr('{{ $json.trial_id }}'), rightValue: '', operator: { type: 'string', operation: 'notEmpty' } }] } } }
});
const noteRespond = node({
  type: 'n8n-nodes-base.respondToWebhook', version: 1.5,
  config: { name: 'Respond Note', parameters: { respondWith: 'json', responseBody: expr('{{ { "ok": true, "trial_id": $(\'Note Webhook\').item.json.params.trial_id, "note": $(\'Note Webhook\').item.json.body.note } }}'), options: { responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } } }
});

export default workflow('trials-api', 'Trials API')
  .add(todayWebhook).to(todayWindow).to(todayQuery).to(todayAggregate).to(todayRespond)
  .add(detailWebhook).to(detailQuery).to(detailFound.onTrue(detailRespond).onFalse(detailNotFound))
  .add(precheckWebhook).to(precheckQuery).to(precheckFound.onTrue(precheckRespond).onFalse(detailNotFound))
  .add(noteWebhook).to(noteQuery).to(noteFound.onTrue(noteRespond).onFalse(detailNotFound));
