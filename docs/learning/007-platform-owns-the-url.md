# 007. 플랫폼이 URL 모양을 바꿔버릴 때 — n8n 동적 경로와 강제 `webhookId`

## 한 줄로
호스팅 플랫폼은 우리가 적은 경로를 **그대로 서빙한다는 보장이 없다.**
n8n Webhook 은 경로에 동적 값(`:param`)이 있으면 노드마다 다른 UUID 를 경로 앞에 **강제로 붙인다** →
"REST 경로"를 얻는 대가로 base URL 이 엔드포인트마다 갈라진다.

## 어떤 상황에서 쓰나

Trials API 를 REST 로 바꾸려면 `trials/:trial_id` 같은 경로 파라미터가 필요했다.
그런데 n8n Webhook 노드 정의에 이 한 줄이 있다:

> `path`: "dynamic values could be specified by using ':' … **If dynamic values are set 'webhookId'
> would be prepended to path.**"

그래서 실제 서빙 URL 이 이렇게 갈린다:

```
GET   /webhook/trials                                          ← 동적 값 없음 → UUID 없음
GET   /webhook/9c35b3bd-…/trials/270341                         ← UUID 필수
PATCH /webhook/e54c6e9b-…/trials/270341/pre-trial-call-check     ← 또 다른 UUID
PATCH /webhook/4c3ebf05-…/trials/270341/note                     ← 또 다른 UUID
```

UUID 는 노드가 생성될 때 자동으로 만들어지고 **끄거나 지정하는 설정이 없다.**
4개가 같은 UUID 를 공유하게 만들 수도 없다 — `…/note` 와 `…/pre-trial-call-check` 는 둘 다 PATCH +
같은 경로 깊이라 n8n 이 구분할 수 없게 된다.

## 코드 요약

플랫폼이 강제한 모양은 **경계 계층 한 곳에서 흡수**한다. 우리는 서버 전용 프록시가 그 자리다:

```ts
// backend/src/lib/n8n.ts  (import "server-only")
export const n8nPaths = {
  trials: () => "/webhook/trials",                       // 동적 값 없음 → UUID 없음
  trialDetail: (id: string) =>
    `/webhook/${requireEnv("N8N_WEBHOOK_ID_TRIAL_DETAIL")}/trials/${encodeURIComponent(id)}`,
  note: (id: string) =>
    `/webhook/${requireEnv("N8N_WEBHOOK_ID_NOTE")}/trials/${encodeURIComponent(id)}/note`,
};
```

덕분에 브라우저가 보는 계약은 UUID 를 전혀 모른다 — `/api/trials/{id}/note` 뿐이다.
**"못생긴 URL" 문제가 곧 "클라이언트 계약" 문제는 아니다.** 경계가 하나 있으면 거기서 끝난다.

## 함정

**1. 규칙을 절반만 적용해서 틀렸다 (실제로 틀림).**
"동적 경로면 UUID 가 붙는다"를 보고 **4개 전부** UUID 형태로 통일했다. 목록(`trials`)은 동적 값이
없어서 UUID 가 붙지 않는데도 `N8N_WEBHOOK_ID_TRIALS` env 를 만들고 curl 도 그렇게 적었다.
사용자가 n8n UI 의 실제 Test URL(`/webhook-test/trials` — UUID 없음)을 보여줘서 잡혔다.
→ 조건부 규칙은 **조건이 거짓인 경우까지** 확인해야 적용이 끝난다.

**2. 도구가 보고하는 URL 과 실제 서빙 URL 이 다를 수 있다.**
MCP `get_workflow_details` 는 정적 경로인 목록에도 UUID 를 붙여 보고했다. n8n UI 는 안 붙였다.
어느 쪽이 진짜인지는 **발행하고 찔러봐야** 안다. 그 전까지는 "미검증"으로 남겨야 했다.

**3. API 로 트리거한 manual 실행은 test webhook 을 arming 하지 않는다.**
`execute_workflow(manual)` 은 116ms 만에 success 로 끝나고 `/webhook-test/...` 는 계속 404 다.
test URL 은 캔버스의 Execute 버튼을 눌러야 한 번 열린다 → **URL 라우팅 검증에는 발행(publish)이 필요하다.**

**4. 단일 노드 복사로 배포 상태를 판단하면 안 된다.**
n8n 캔버스에서 노드 하나만 복사하면 (a) 기본값 파라미터(`httpMethod: GET`)가 생략되고
(b) 복사 범위 밖으로 가는 connection 이 `[[]]` 로 잘려 나온다. 둘 다 "반영 안 됨"처럼 보이지만 아니다.
배포 상태는 워크플로우 조회(또는 버전 히스토리의 `versionId`)로 확인한다.

## 이 노트가 나온 작업
- 브랜치 `backend` (2026-07-25)
- n8n 워크플로우 "[Trial API] - Main" (`OHSTgJsHd6337qgf`) 버전 `6f890280` — 4개 웹훅 경로 REST 화
- `backend/src/lib/n8n.ts` (`n8nPaths`) · `.env.example` (`N8N_WEBHOOK_ID_*`) · `docs/backend/workflow.ts`
- 관련: [[006-identifier-in-path-vs-body]]
