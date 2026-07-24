// n8n Workflow SDK — Trials API (cloud n8n: naonowadmin.app.n8n.cloud)
// 4 webhook 엔드포인트 → Postgres(executeQuery) → respondToWebhook(JSON).
// 실 스키마 검증(2026-07-24, DB=naonow prod, cred=automation_coupons) 기준으로 작성됨.
// validate_workflow 통과(node 15). 대상 워크플로우 OHSTgJsHd6337qgf 에 MCP 접근 켜지면 투입.
//
// 전제:
//  - 테이블 public."TrialDashboardState" 가 존재해야 함 (ddl.sql — DB 소유자가 생성).
//  - 각 Webhook 의 Header Auth 자격증명(x-api-key = N8N_API_TOKEN) 을 붙여야 함.
//  - Postgres 자격증명 id=TYGrEaGEtyIrZUHe (automation_coupons, DB=naonow).
//
// 확정 스키마 사실:
//  - status enum: canceled(L1), 값 {scheduled,in_progress,canceled,completed,paid,approved,rescheduled}
//  - Mentors: firstName/lastName/tier/gender (단일 name 없음)
//  - CallQueues.studentId 로 조인 (LATERAL 최신 1건)
//  - sales_rep_name: Users 에 이름 컬럼 없음 → email local-part 로 대체(추후 확정)

import { workflow, node, trigger, newCredential, ifElse, expr } from '@n8n/workflow-sdk';

const apiKeyCred = newCredential('Trials API x-api-key');

const todayWebhook = trigger({
  type: 'n8n-nodes-base.webhook', version: 2.1,
  config: { name: 'Today Webhook', parameters: { httpMethod: 'GET', path: 'trials/today', authentication: 'headerAuth', responseMode: 'responseNode', options: {} }, credentials: { httpHeaderAuth: apiKeyCred } }
});
const detailWebhook = trigger({
  type: 'n8n-nodes-base.webhook', version: 2.1,
  config: { name: 'Detail Webhook', parameters: { httpMethod: 'GET', path: 'trials/detail', authentication: 'headerAuth', responseMode: 'responseNode', options: {} }, credentials: { httpHeaderAuth: apiKeyCred } }
});
const precheckWebhook = trigger({
  type: 'n8n-nodes-base.webhook', version: 2.1,
  config: { name: 'Precheck Webhook', parameters: { httpMethod: 'PATCH', path: 'trials/precheck', authentication: 'headerAuth', responseMode: 'responseNode', options: {} }, credentials: { httpHeaderAuth: apiKeyCred } }
});
const noteWebhook = trigger({
  type: 'n8n-nodes-base.webhook', version: 2.1,
  config: { name: 'Note Webhook', parameters: { httpMethod: 'PATCH', path: 'trials/note', authentication: 'headerAuth', responseMode: 'responseNode', options: {} }, credentials: { httpHeaderAuth: apiKeyCred } }
});

// Route 1: GET /trials/today
const todayQuery = node({
  type: 'n8n-nodes-base.postgres', version: 2.6,
  config: {
    name: 'Query Today', parameters: { resource: 'database', operation: 'executeQuery', options: {},
      query: `SELECT
  l.id::text AS trial_id,
  to_char(l."startAt" AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS') || '+09:00' AS trial_time,
  s.id::text AS student_id,
  u.email AS student_email,
  u."phoneNumber" AS student_phone_number,
  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', m."firstName", m."lastName")), ''), '') AS mentor_name,
  m.tier::text AS mentor_tier,
  COALESCE(split_part(rep.email, '@', 1), '') AS sales_rep_name,
  l.status::text AS status,
  COALESCE(d."precheck1", FALSE) AS precheck_1,
  COALESCE(d."precheck2", FALSE) AS precheck_2,
  COALESCE(d."precheck3", FALSE) AS precheck_3,
  COALESCE(d."preCallDone", FALSE) AS pre_call_done,
  COALESCE(d."postCallDone", FALSE) AS post_call_done,
  (cq.lifecycle = 'converted' OR cq."purchasedAt" IS NOT NULL) AS converted
FROM "Lessons" l
JOIN "Students" s ON s.id = l."studentId"
JOIN "Users" u ON u.id = s."userId"
LEFT JOIN "Mentors" m ON m.id = l."mentorId"
LEFT JOIN LATERAL (
  SELECT cq.* FROM "CallQueues" cq WHERE cq."studentId" = s.id ORDER BY cq."updatedAt" DESC LIMIT 1
) cq ON TRUE
LEFT JOIN "Users" rep ON rep.id = COALESCE(cq."claimedByAdminId", cq."autoAssignedToId")
LEFT JOIN "TrialDashboardState" d ON d."lessonId" = l.id
WHERE l."isTrial" = TRUE
  AND (l."startAt" AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date
ORDER BY l."startAt"`
    },
    credentials: { postgres: { id: 'TYGrEaGEtyIrZUHe', name: 'automation_coupons' } }
  }
});
const todayAggregate = node({
  type: 'n8n-nodes-base.aggregate', version: 1,
  config: { name: 'Wrap trials', parameters: { aggregate: 'aggregateAllItemData', destinationFieldName: 'trials', options: {} } }
});
const todayRespond = node({
  type: 'n8n-nodes-base.respondToWebhook', version: 1.5,
  config: { name: 'Respond Today', parameters: { respondWith: 'json', responseBody: expr('{{ $json }}'), options: { responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } } }
});

// Route 2: GET /trials/detail?trial_id=
const detailQuery = node({
  type: 'n8n-nodes-base.postgres', version: 2.6,
  config: {
    name: 'Query Detail', alwaysOutputData: true,
    parameters: { resource: 'database', operation: 'executeQuery',
      options: { queryReplacement: expr('{{ [$json.query.trial_id] }}') },
      query: `SELECT
  l.id::text AS trial_id,
  s.id::text AS student_id,
  u.email AS student_email,
  u."phoneNumber" AS student_phone_number,
  s.level::text || COALESCE(' · ' || s."langLevel", '') AS level,
  m.id::text AS mentor_id,
  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', m."firstName", m."lastName")), ''), '') AS mentor_name,
  m.gender::text AS mentor_gender,
  COALESCE(cq."answersJson"->'interests', '[]'::jsonb) AS interests,
  to_char(l."startAt" AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS trial_date,
  d."salesNote" AS sales_note
FROM "Lessons" l
JOIN "Students" s ON s.id = l."studentId"
JOIN "Users" u ON u.id = s."userId"
LEFT JOIN "Mentors" m ON m.id = l."mentorId"
LEFT JOIN LATERAL (
  SELECT cq.* FROM "CallQueues" cq WHERE cq."studentId" = s.id ORDER BY cq."updatedAt" DESC LIMIT 1
) cq ON TRUE
LEFT JOIN "TrialDashboardState" d ON d."lessonId" = l.id
WHERE l.id = $1::int`
    },
    credentials: { postgres: { id: 'TYGrEaGEtyIrZUHe', name: 'automation_coupons' } }
  }
});
const detailFound = ifElse({
  version: 2.2,
  config: { name: 'Detail found?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, combinator: 'and', conditions: [{ leftValue: expr('{{ $json.trial_id }}'), rightValue: '', operator: { type: 'string', operation: 'notEmpty' } }] } } }
});
const detailRespond = node({
  type: 'n8n-nodes-base.respondToWebhook', version: 1.5,
  config: { name: 'Respond Detail', parameters: { respondWith: 'firstIncomingItem', options: { responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } } }
});
const detailNotFound = node({
  type: 'n8n-nodes-base.respondToWebhook', version: 1.5,
  config: { name: 'Respond 404', parameters: { respondWith: 'json', responseBody: expr('{{ { "error": "Trial not found" } }}'), options: { responseCode: 404 } } }
});

// Route 3: PATCH /trials/precheck
const precheckQuery = node({
  type: 'n8n-nodes-base.postgres', version: 2.6,
  config: {
    name: 'Upsert Precheck',
    parameters: { resource: 'database', operation: 'executeQuery',
      options: { queryReplacement: expr('{{ [$json.body.trial_id, $json.body.stage, $json.body.checked] }}') },
      query: `INSERT INTO "TrialDashboardState" AS d ("lessonId","precheck1","precheck2","precheck3")
VALUES ($1::int,
  CASE WHEN $2::int = 1 THEN $3::boolean ELSE FALSE END,
  CASE WHEN $2::int = 2 THEN $3::boolean ELSE FALSE END,
  CASE WHEN $2::int = 3 THEN $3::boolean ELSE FALSE END)
ON CONFLICT ("lessonId") DO UPDATE SET
  "precheck1" = CASE WHEN $2::int = 1 THEN $3::boolean ELSE d."precheck1" END,
  "precheck2" = CASE WHEN $2::int = 2 THEN $3::boolean ELSE d."precheck2" END,
  "precheck3" = CASE WHEN $2::int = 3 THEN $3::boolean ELSE d."precheck3" END,
  "updatedAt" = now()`
    },
    credentials: { postgres: { id: 'TYGrEaGEtyIrZUHe', name: 'automation_coupons' } }
  }
});
const precheckRespond = node({
  type: 'n8n-nodes-base.respondToWebhook', version: 1.5,
  config: { name: 'Respond Precheck', parameters: { respondWith: 'json', responseBody: expr('{{ { "ok": true, "trial_id": $(\'Precheck Webhook\').item.json.body.trial_id, "stage": $(\'Precheck Webhook\').item.json.body.stage, "checked": $(\'Precheck Webhook\').item.json.body.checked } }}'), options: { responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } } }
});

// Route 4: PATCH /trials/note
const noteQuery = node({
  type: 'n8n-nodes-base.postgres', version: 2.6,
  config: {
    name: 'Upsert Note',
    parameters: { resource: 'database', operation: 'executeQuery',
      options: { queryReplacement: expr('{{ [$json.body.trial_id, $json.body.note] }}') },
      query: `INSERT INTO "TrialDashboardState" AS d ("lessonId","salesNote")
VALUES ($1::int, NULLIF($2, ''))
ON CONFLICT ("lessonId") DO UPDATE SET
  "salesNote" = NULLIF($2, ''),
  "updatedAt" = now()`
    },
    credentials: { postgres: { id: 'TYGrEaGEtyIrZUHe', name: 'automation_coupons' } }
  }
});
const noteRespond = node({
  type: 'n8n-nodes-base.respondToWebhook', version: 1.5,
  config: { name: 'Respond Note', parameters: { respondWith: 'json', responseBody: expr('{{ { "ok": true, "trial_id": $(\'Note Webhook\').item.json.body.trial_id, "note": $(\'Note Webhook\').item.json.body.note } }}'), options: { responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } } }
});

export default workflow('trials-api', 'Trials API')
  .add(todayWebhook).to(todayQuery).to(todayAggregate).to(todayRespond)
  .add(detailWebhook).to(detailQuery).to(detailFound.onTrue(detailRespond).onFalse(detailNotFound))
  .add(precheckWebhook).to(precheckQuery).to(precheckRespond)
  .add(noteWebhook).to(noteQuery).to(noteRespond);
