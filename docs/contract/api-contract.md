# Frontend Handoff — Trials API 계약

> 이 문서 + [openapi.yaml](./openapi.yaml) 가 **프론트↔백엔드의 유일한 인터페이스(계약)** 다.
> 프론트(`frontend` 브랜치)는 이 계약만 보고 `src/**` 를 맞춘다. 백엔드(n8n cloud + `backend` 브랜치)와
> **코드 의존이 없다** — 오직 JSON 모양(계약)으로만 연결된다.

## 읽는 법 (브랜치 교차 없이)
계약 문서는 **`backend` 브랜치 소유**다. 프론트 세션에서 `git checkout` 없이 아래 중 하나로 읽는다:
- 워크트리 폴더 직접 열기: `../backend/docs/contract/` (디스크에 실재하는 별도 폴더)
- 또는 `git show backend:docs/contract/openapi.yaml` / `git show backend:docs/contract/api-contract.md`

## 계약 (2026-07-25 REST 화 반영)

브라우저 호출 엔드포인트(프론트 자기 도메인 `/api/*` → n8n `/webhook/*` 프록시). 상세 스키마는 openapi.yaml.

| 프론트 (브라우저가 호출) | 메서드 | 요청 body | n8n (서버 전용) |
|---|---|---|---|
| `/api/trials` | GET | — | `/webhook/trials` |
| `/api/trials/{id}` | GET | — | `/webhook/<hookId>/trials/<id>` |
| `/api/trials/{id}/pre-trial-call-check` | PATCH | `{stage, checked}` | `/webhook/<hookId>/trials/<id>/pre-trial-call-check` |
| `/api/trials/{id}/note` | PATCH | `{note}` | `/webhook/<hookId>/trials/<id>/note` |

**`trial_id` 는 경로에만 있다 — 요청 body 에 넣지 않는다.** 응답에는 에코로 `trial_id` 가 들어온다.

`<hookId>` 는 프론트가 알 필요 없다(서버 전용 env). n8n Webhook 노드는 경로에 동적 값(`:trial_id`)이
있으면 노드별 `webhookId`(UUID)를 경로 앞에 강제로 붙이기 때문에 백엔드가 이를 흡수한다.
목록만 동적 값이 없어 UUID 가 붙지 않는다(n8n UI 실측 확인).

## 프론트 변경 체크리스트

`backend` 브랜치는 이미 이 계약에 맞춰져 있다(mock·라이브 모두 `pnpm test:contract` 통과).
아래는 **`frontend` 브랜치에 남은 일**이다.

### 1. 쓰기 엔드포인트 REST 화 ★ 이번에 새로 생긴 항목

`precheck` → `pre-trial-call-check` 로 이름이 바뀌는 것과 **경로에 `trial_id` 가 들어가는 것**이 함께 일어난다.

**(a) route handler 폴더 이동** — 쓰기 2개가 `[id]` 아래로 들어간다:
```
src/app/api/trials/precheck/route.ts  →  src/app/api/trials/[id]/pre-trial-call-check/route.ts
src/app/api/trials/note/route.ts      →  src/app/api/trials/[id]/note/route.ts
```
핸들러 시그니처가 바뀐다 (Next 15+ 는 `params` 가 Promise):
```ts
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: trial_id } = await params;
  const { stage, checked } = await req.json();   // body 에 trial_id 없음
  ...
}
```
> 실물 참고: `../backend/src/app/api/trials/[id]/pre-trial-call-check/route.ts` · `[id]/note/route.ts`

**(b) api client** — 함수 시그니처가 `(trialId, body)` 2인자로 바뀐다:
```ts
// src/lib/api.ts
export async function savePreTrialCallCheck(
  trialId: string,
  input: PreTrialCallCheckRequest,          // { stage, checked }
): Promise<PreTrialCallCheckResponse> {
  const res = await fetch(
    `/api/trials/${encodeURIComponent(trialId)}/pre-trial-call-check`,
    { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify(input) },
  );
  return toJson<PreTrialCallCheckResponse>(res);
}

export async function saveNote(
  trialId: string,
  input: NoteRequest,                        // { note }
): Promise<NoteResponse> {
  const res = await fetch(`/api/trials/${encodeURIComponent(trialId)}/note`, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return toJson<NoteResponse>(res);
}
```

**(c) 타입** — 요청 타입에서 `trial_id` 를 뺀다:
```ts
// src/types/trial.ts
export interface PreTrialCallCheckRequest { stage: PreTrialCallStage; checked: boolean }
export interface NoteRequest { note: string }
// 응답은 그대로 trial_id 를 포함한다 (에코)
```

**(d) 훅 — 여기가 유일하게 까다로운 지점.**

`useMutation` 의 `mutationFn` 은 **인자를 하나만** 받는다. 그런데 `onMutate` 의 optimistic 갱신은
`vars.trial_id` 가 반드시 필요하다(`usePrecheckMutation` 은 `t.trial_id === vars.trial_id`,
`useNoteMutation` 은 `trialKeys.detail(vars.trial_id)`).

→ **훅의 variables 타입과 요청 body 타입을 분리한다.** `trial_id` 는 variables 에는 남기고,
`mutationFn` 에서 구조분해로 떼어내 경로로 보낸다:

```ts
// usePrecheckMutation.ts → usePreTrialCallCheckMutation.ts
type Vars = { trial_id: string } & PreTrialCallCheckRequest;   // { trial_id, stage, checked }

return useMutation({
  mutationFn: ({ trial_id, ...body }: Vars) =>
    savePreTrialCallCheck(trial_id, body),                     // ← trial_id 는 경로로, 나머지는 body
  onMutate: async (vars: Vars) => {
    // 기존 로직 그대로 — vars.trial_id 를 계속 쓸 수 있다
  },
});
```
```ts
// useNoteMutation.ts
type Vars = { trial_id: string } & NoteRequest;                // { trial_id, note }

return useMutation({
  mutationFn: ({ trial_id, ...body }: Vars) => saveNote(trial_id, body),
  scope: { id: "trial-note" },     // 유지 — 자동 저장 직렬화
  onMutate: async (vars: Vars) => {
    const key = trialKeys.detail(vars.trial_id);               // 그대로 동작
    ...
  },
});
```
**호출부(컴포넌트)는 바꾸지 않아도 된다** — `mutate({ trial_id, stage, checked })` 형태를 그대로 유지한다.
바뀌는 것은 훅 내부의 `mutationFn` 한 줄과 타입뿐이다.

**(e) 마이그레이션 누락 시 증상 (실측)** — 옛 경로로 PATCH 를 보내면 **404 가 아니라 `405`** 가 온다.
`/api/trials/note` 가 `/api/trials/[id]` 라우트에 `id="note"` 로 매칭되고, 그 라우트에는 GET 만 있어서다.
"405 Method Not Allowed" 를 보면 경로 마이그레이션이 안 된 것이다.

### 2. student_name 추가
목록/상세에 `student_name: string` 신규. TrialsTable "Student" 컬럼을 `#id` → **이름 표시**(보조로 #id).

### 3. pre_trial_call_checks: boolean[]
기존 `precheck_1/2/3`(3 boolean) 제거, 길이 3 배열로.
· `TrialsTable`: `checked={t.pre_trial_call_checks[stage-1]}`
· `computeStats` remaining = `t.pre_trial_call_checks.every(v => !v)`
· type · mock
· `usePrecheckMutation` 의 `stageKey()` 헬퍼(`precheck_${stage}`)는 **삭제**하고 배열 인덱스 갱신으로 바꾼다:
```ts
qc.setQueryData<TrialsTodayResponse>(trialKeys.list(), (old) =>
  old ? { trials: old.trials.map((t) =>
    t.trial_id === vars.trial_id
      ? { ...t, pre_trial_call_checks: t.pre_trial_call_checks.map(
          (v, i) => (i === vars.stage - 1 ? vars.checked : v)) as [boolean, boolean, boolean] }
      : t) } : old);
```

### 4. KPI 카드 삭제
`pre_call_done`·`post_call_done` 백엔드 제거됨 → StatCards 두 타일 + `computeStats` 해당 필드 삭제.

### 5. `call_queue_url` 제거 — ⚠ 근거 재확인 필요
상세 응답에서 빠졌고 스펙에도 없다. 다만 이 "제거" 지시의 출처는 `../docs/PRD.md:169`("폐기됨")이며
그 문장은 Claude 가 작성한 문서 변경(`c519c56`)에서 나왔다. 원본 스펙
`../docs/cloudtalk-call-button.md:80` 은 "대체하거나 **병기**"로 제거를 강제하지 않는다.
**제거할지 병기할지 사용자 확인 후 진행할 것.**

### 6. `sales_note` 는 필수 필드
상세 응답에 항상 존재하며 미기록이면 `null`.

### 7. enum 값 정정
`mentor_tier` 는 `elite|normal`(**`basic` 없음**), trial `status` 는
`approved|canceled|completed|paid`(**`scheduled` 없음**), `mentor_gender` 는 `female|male|nonbinary`.
mock 시드에 남은 `basic`/`scheduled` 를 교체할 것. (라이브 DB distinct 실측 근거)

### 8. 노트 기능 코드 인계 — ✅ 완료
`useNoteMutation.ts` 는 `frontend` 워크트리에 복사 완료. 위 **1-(d)** 대로 `mutationFn` 만 고치면 된다.

### 9. base URL — 백엔드가 흡수함, 프론트 작업 없음
n8n production URL 의 `webhookId` 문제는 backend 의 `src/lib/n8n.ts` + `N8N_WEBHOOK_ID_*` env 로
처리했다. 프론트는 `/api/*` 만 호출하므로 영향 없다.

## 검증 방법

백엔드 브랜치의 러너로 어느 쪽 응답이든 스펙과 대조할 수 있다(의존성 0, 서버 없이도 mock 검증 가능):

```bash
# backend 워크트리에서
pnpm test:contract                                              # mock 대조
node test/contract-check.mts --base http://localhost:3000/api    # 프론트 dev 서버 대조
```
> ⚠ 포트 주의: 두 워크트리가 같은 3000 을 쓴다. 프론트 dev 가 3000 을 점유한 상태에서 백엔드 dev 를
> 띄우면 조용히 다른 포트로 밀리고, `--base :3000` 은 **프론트 서버**를 검사한다(실제로 한 번 착각했다).
> 백엔드는 `pnpm exec next dev --port 3100` 처럼 포트를 명시할 것.

## 계약 변경 프로토콜
응답/요청 모양을 바꿀 땐 **openapi.yaml 을 먼저 갱신**(계약이 SoT) → 백엔드 n8n 과 프론트 `src/**` 가
각자 그 모양으로 수렴. 러너로 대조해 drift 를 잡는다.
