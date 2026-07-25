// n8n Workflow SDK — Trials API (cloud n8n: naonowadmin.app.n8n.cloud)
// 배포 대상: 워크플로우 "[Trial API] - Main" (id OHSTgJsHd6337qgf). 이 파일은 배포본과 동기 유지.
// 4 webhook 엔드포인트 → Postgres(executeQuery) → respondToWebhook(JSON).
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
  config: { name: 'Today Webhook', parameters: { httpMethod: 'GET', path: 'trials/today', responseMode: 'responseNode', options: {} } }
});
const detailWebhook = trigger({
  type: 'n8n-nodes-base.webhook', version: 2.1,
  config: { name: 'Detail Webhook', parameters: { httpMethod: 'GET', path: 'trials/detail', responseMode: 'responseNode', options: {} } }
});
const precheckWebhook = trigger({
  type: 'n8n-nodes-base.webhook', version: 2.1,
  config: { name: 'Pre-trial Call Webhook', parameters: { httpMethod: 'PATCH', path: 'trials/pre-trial-call', responseMode: 'responseNode', options: {} } }
});
const noteWebhook = trigger({
  type: 'n8n-nodes-base.webhook', version: 2.1,
  config: { name: 'Note Webhook', parameters: { httpMethod: 'PATCH', path: 'trials/note', responseMode: 'responseNode', options: {} } }
});

// Route 1: GET /trials/today
const todayQuery = node({
  type: 'n8n-nodes-base.postgres', version: 2.6,
  config: { name: 'Query Today', credentials: PG, parameters: { resource: 'database', operation: 'executeQuery', options: {},
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
  COALESCE(d.pre_trial_calls, ARRAY[false,false,false]::boolean[]) AS pre_trial_calls,
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
  AND (l."startAt" AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date
ORDER BY l."startAt"` } }
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
  config: { name: 'Query Detail', alwaysOutputData: true, credentials: PG,
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

// Route 3: PATCH /trials/pre-trial-call  (단일 stage(1..3) 의 진행 여부를 배열 요소로 upsert)
const precheckQuery = node({
  type: 'n8n-nodes-base.postgres', version: 2.6,
  config: { name: 'Upsert Pre-trial Call', credentials: PG,
    parameters: { resource: 'database', operation: 'executeQuery',
      options: { queryReplacement: expr('{{ [$json.body.trial_id, $json.body.stage, $json.body.checked] }}') },
      query: `INSERT INTO automation.trial_dashboard_state AS d (lesson_id, pre_trial_calls)
VALUES ($1::int, ARRAY[
  ($2::int = 1 AND $3::boolean),
  ($2::int = 2 AND $3::boolean),
  ($2::int = 3 AND $3::boolean)
]::boolean[])
ON CONFLICT (lesson_id) DO UPDATE SET
  pre_trial_calls[$2::int] = $3::boolean,
  updated_at = now()` }
  }
});
const precheckRespond = node({
  type: 'n8n-nodes-base.respondToWebhook', version: 1.5,
  config: { name: 'Respond Pre-trial Call', parameters: { respondWith: 'json', responseBody: expr('{{ { "ok": true, "trial_id": $(\'Pre-trial Call Webhook\').item.json.body.trial_id, "stage": $(\'Pre-trial Call Webhook\').item.json.body.stage, "checked": $(\'Pre-trial Call Webhook\').item.json.body.checked } }}'), options: { responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } } }
});

// Route 4: PATCH /trials/note
const noteQuery = node({
  type: 'n8n-nodes-base.postgres', version: 2.6,
  config: { name: 'Upsert Note', credentials: PG,
    parameters: { resource: 'database', operation: 'executeQuery',
      options: { queryReplacement: expr('{{ [$json.body.trial_id, $json.body.note] }}') },
      query: `INSERT INTO automation.trial_dashboard_state AS d (lesson_id, sales_note)
VALUES ($1::int, NULLIF($2, ''))
ON CONFLICT (lesson_id) DO UPDATE SET
  sales_note = NULLIF($2, ''),
  updated_at = now()` }
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
