# 006. 식별자를 경로에 둘 것인가 body 에 둘 것인가

## 한 줄로
REST 에서 **"무엇을 바꾸는가"(식별자)는 경로**에, **"무엇으로 바꾸는가"(값)는 body** 에 둔다.
둘을 섞어 body 에 식별자를 넣으면 경로가 리소스가 아니라 "동작 이름"이 되고, 같은 리소스에 대한
연산들이 URL 상에서 흩어진다.

## 어떤 상황에서 쓰나

우리 쓰기 API 는 원래 이랬다:

```
PATCH /api/trials/pre-trial-call-check   body { trial_id, stage, checked }
PATCH /api/trials/note                   body { trial_id, note }
```

읽기는 `/api/trials`, `/api/trials/{id}` 로 리소스 모양인데 쓰기만 동작 이름이었다.
같은 trial 을 다루는 4개 연산이 URL 트리에서 두 갈래로 갈라져 있어서,
"trial 하나에 무엇을 할 수 있나"를 URL 만 보고 알 수 없었다. 바꾼 뒤:

```
GET   /api/trials
GET   /api/trials/{id}
PATCH /api/trials/{id}/pre-trial-call-check   body { stage, checked }
PATCH /api/trials/{id}/note                   body { note }
```

`/api/trials/{id}` 아래에 그 trial 에 대한 모든 연산이 모인다. 파일 트리도 그대로 따라간다
(`src/app/api/trials/[id]/note/route.ts`).

## 코드 요약

식별자가 경로로 올라가면 **클라이언트 함수의 인자도 쪼개진다**:

```ts
// backend/src/lib/api.ts
export async function saveNote(trialId: string, input: NoteRequest) {   // ← 2인자
  const res = await fetch(`/api/trials/${encodeURIComponent(trialId)}/note`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),          // { note } — trial_id 없음
  });
  return toJson<NoteResponse>(res);
}
```

서버는 경로에서 받는다:

```ts
// backend/src/app/api/trials/[id]/note/route.ts
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: trial_id } = await params;     // Next 15+ 는 params 가 Promise
  const { note } = await req.json();         // body 에는 값만
```

**응답에는 `trial_id` 를 그대로 에코로 넣는다.** 경로에서 왔으니 body 에 없지만,
클라이언트가 "어느 항목의 결과인지" 구분하려면 응답에는 있어야 한다.
(우리 스펙 `NoteResponse` = `{ok, trial_id, note}`)

## 함정

**1. `useMutation` 의 `mutationFn` 은 인자를 하나만 받는다.**
`mutationFn: saveNote` 로 두면 2인자 함수에 variables 객체 하나만 들어가서 깨진다.
그런데 `onMutate` 의 optimistic 갱신은 캐시 키를 만들기 위해 `trial_id` 가 **반드시** 필요하다
(`trialKeys.detail(vars.trial_id)`).

→ **훅의 variables 타입과 요청 body 타입을 분리한다.** `trial_id` 는 variables 에 남기고,
`mutationFn` 에서 구조분해로 떼어 경로로 넘긴다:

```ts
type Vars = { trial_id: string } & NoteRequest;   // 훅이 받는 것
mutationFn: ({ trial_id, ...body }: Vars) => saveNote(trial_id, body),
```

식별자가 경로로 갔다고 해서 **클라이언트 상태 계층에서도 사라지는 것은 아니다.**
"전송 형식"과 "내부 variables"를 같은 타입으로 쓰던 습관이 여기서 깨진다.

**2. 옛 경로는 404 가 아니라 405 로 실패한다.**
Next 에서 `PATCH /api/trials/note` 는 `/api/trials/[id]` 라우트에 `id="note"` 로 매칭되고,
그 라우트에 GET 만 있으면 **405 Method Not Allowed** 가 나온다. 실측으로 확인했다.
`/{id}` 형태의 동적 라우트가 있으면 형제 정적 경로의 오타·미마이그레이션이 404 로 드러나지 않는다.

**3. body 에서 식별자를 뺐으면 검증 메시지도 같이 고친다.**
`"Body must be { trial_id, stage, checked }"` 를 남겨두면 호출자가 없는 필드를 넣으려 한다.

## 이 노트가 나온 작업
- 브랜치 `backend` (2026-07-25, 미커밋)
- `docs/contract/openapi.yaml` — `/trials/{id}/pre-trial-call-check` · `/trials/{id}/note` 로 경로 변경, 요청 스키마에서 `trial_id` 제거
- `src/app/api/trials/[id]/{note,pre-trial-call-check}/route.ts` · `src/lib/api.ts` · `src/types/trial.ts`
- 프론트 인계 지시: `backend/docs/contract/api-contract.md` §1
- 관련: [[003-optimistic-update]] (여기의 `vars.trial_id` 가 왜 필요한지)
