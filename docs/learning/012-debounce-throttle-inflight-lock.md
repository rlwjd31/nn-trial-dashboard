# 012. 클릭이 "먹통"일 때 — debounce · throttle · in-flight 잠금 구분하기

> 이 노트는 예외적으로 길다. 실제 버그 하나를 처음부터 끝까지(증상 → 원인 추적 → 수정 → 검증)
> 따라가면서, 자주 헷갈리는 세 기법의 경계를 같이 정리한다. 개념은 하나다: **입력의 즉시성과
> 네트워크 쓰기를 어떻게 분리하는가.**

---

## 1. 증상

Pre-trial 체크박스(목록 행의 1·2·3)를 클릭했을 때 **반영이 느리고, 연속으로 누르면 입력이 씹혔다.**
"debounce 나 throttle 이 걸려 있나?" 를 먼저 의심했다.

## 2. 원인 추적

### (a) 코드에는 debounce/throttle 이 없었다
`PreTrialCallCheckbox.tsx` 에서 클릭은 곧바로 `mutation.mutate(...)` 로 나가고 있었다.
지연을 만드는 타이머는 어디에도 없었다. 대신 이 줄이 있었다:

```tsx
disabled={disabled || mutation.isPending}   // ← 저장이 끝날 때까지 스스로를 잠근다
```

### (b) 그 잠금이 얼마나 긴지 실측했다
막연히 "빠를 것" 이라 가정하지 않고 왕복을 쟀다(읽기 3회 — 쓰기는 프로덕션이라 실행하지 않음):

```
GET /api/trials/{id}   0.644s / 0.629s / 0.654s
GET /api/trials        0.670s / 0.689s
```

경로가 `브라우저 → Next Route Handler → n8n → Cloud SQL` 이라 **왕복 ~0.65초**다.
즉 클릭 후 0.65초 동안 체크박스는 죽어 있었고, 그 사이의 클릭은 **조용히 버려졌다.**
"연타가 씹힌다" 는 체감의 정체가 이것이다.

### (c) 숨어 있던 두 번째 지연
같은 훅의 `onMutate` 가 이렇게 돼 있었다:

```ts
onMutate: async (vars) => {
  await qc.cancelQueries({ queryKey: trialKeys.list() })   // ← 먼저 await
  const prev = qc.getQueryData(trialKeys.list())
  qc.setQueryData(trialKeys.list(), next)                  // ← 그 다음에야 화면 반영
}
```

`cancelQueries` 는 **진행 중인 refetch 가 정리될 때까지 기다린다.** 창 포커스 복귀 등으로 목록
refetch(0.65초)가 떠 있는 순간에 클릭하면, 체크 표시가 그 refetch 가 끝난 뒤에야 나타난다.
TanStack 공식 예제가 `cancelQueries` 를 맨 앞에 두기 때문에 그대로 따라 쓴 코드였는데,
**"즉시 반응" 이 목표일 때는 순서가 잘못이다.**

## 3. 수정 (커밋 `8a2e545`)

### (1) in-flight 잠금 제거
```diff
- disabled={disabled || mutation.isPending}
+ disabled={disabled}
```
취소된 trial 만 비활성이다. 저장 중이라는 이유로는 막지 않는다.

**근거**: optimistic update 를 쓰는 순간 화면의 값이 이미 "정답" 이다. 서버 응답은 확인 절차일 뿐이고,
실패하면 훅이 이전 값으로 롤백하고 토스트로 알린다([003](./003-optimistic-update.md)).
그런데 잠금은 optimistic 으로 벌어놓은 이득(대기 시간 은닉)을 그대로 반납한다.

### (2) 낙관 반영을 첫 `await` 앞으로
```ts
onMutate: async (vars) => {
  const prev = qc.getQueryData<TrialsTodayResponse>(trialKeys.list())

  // ① 캐시를 먼저 고친다 — await 앞이라 클릭과 같은 tick 에 화면이 바뀐다
  qc.setQueryData<TrialsTodayResponse>(trialKeys.list(), (old) => old ? {
    trials: old.trials.map((t) => t.trial_id === vars.trial_id ? {
      ...t,
      pre_trial_call_checks: t.pre_trial_call_checks.map(
        (v, i) => (i === vars.stage - 1 ? vars.checked : v)),
    } : t),
  } : old)

  // ② 그 다음 진행 중 refetch 를 취소한다 — 늦게 도착한 응답이 낙관값을 덮지 않게
  await qc.cancelQueries({ queryKey: trialKeys.list() })

  return { prev }
}
```
`await` 를 만나기 전까지는 동기 실행이므로, ①은 클릭 이벤트와 같은 tick 에 끝난다.
②를 뒤로 미뤄도 취소 목적은 달성된다(응답이 도착해도 취소된 쿼리의 결과는 캐시에 반영되지 않는다).

### (3) 연타 순서를 scope 로 보장
잠금을 풀면 연타가 전부 요청으로 나간다. 병렬이면 **늦게 도착한 옛 값이 최신 값을 덮을 수 있다**
(체크 → 해제를 빠르게 하면 DB 에 `true` 가 남을 수 있다).

```ts
useMutation({
  mutationFn: ({ trial_id, ...body }) => savePreTrialCallCheck(trial_id, body),
  scope: { id: `pre-trial-call-check:${trialId}:${stage}` },   // 같은 scope = 순차 실행
  ...
})
```
- 같은 `scope.id` 를 가진 mutation 은 **직렬**로 실행된다(앞의 것이 끝나야 다음이 시작).
- id 에 `trialId`·`stage` 를 넣었으므로 **다른 체크박스는 서로를 막지 않는다.**
- `scope` 는 mutate 인자로 못 바꾼다(훅 옵션) → 컴포넌트가 자기 id 를 훅에 넘기는 형태로 만들었다:
  `usePreTrialCallCheckMutation(\`pre-trial-call-check:${trialId}:${stage}\`)`.

## 4. 검증 — 프로덕션에 쓰지 않고 확인하는 법

쓰기 경로라서 실제로 누르면 `automation.trial_dashboard_state` 에 남는다. 그래서 Playwright 로
**PATCH 를 가로채 가짜 0.8초 서버로 응답**시켜 반응성만 측정했다:

```ts
await page.route(/\/api\/trials\/\d+\/pre-trial-call-check$/, async (route) => {
  sent.push(route.request().postDataJSON().checked)
  await new Promise((r) => setTimeout(r, 800))          // 느린 서버 흉내
  await route.fulfill({ status: 200, body: JSON.stringify({ ok: true, ... }) })
})
```

| 측정 | 결과 |
|---|---|
| 클릭 → `aria-checked` 변경 | **91ms** (서버는 800ms) |
| 저장 중 `disabled` 여부 | 아님 ✓ |
| 3연타 입력 소요 | 133ms — 막힘 없음 |
| 실제 전송된 요청 수 | 4건(최초 1 + 연타 3), 순차 |
| 최종 화면 상태 vs 마지막 전송값 | 일치 ✓ |

**함정**: 처음엔 연타 직후에 요청 수를 셌더니 1건이었다. scope 직렬화라 **뒤의 요청은 아직 대기 중**이었던
것이다(테스트가 틀렸고 코드는 맞았다). `expect.poll` 로 다 빠질 때까지 기다려서 4건을 확인했다.
→ *비동기 큐를 검증할 때 "지금 몇 개?" 는 거의 항상 틀린 질문이다.*

---

## 5. 개념 정리 — 셋은 서로 다른 문제를 푼다

### 정의
- **debounce**: 이벤트가 **멈춘 뒤** N ms 지나면 1회 실행. 이벤트마다 타이머를 **리셋**한다.
- **throttle**: 이벤트가 이어지는 동안 **N ms 마다 최대 1회** 실행. 타이머를 리셋하지 않는다.
- **in-flight 잠금**: 요청이 끝날 때까지 입력을 막는다(`disabled`). **타이머와 무관** — 이번 원인이 이것.

### 타임라인
입력 6번(`|`), 실제 실행(`▲`):
```
입력      |  |  |  |     |  |
debounce                    ·······▲     마지막 입력 후 N ms. 중간은 전부 취소
throttle  ▲       ▲          ▲          N ms 간격으로 규칙적으로. 중간 값은 버려짐
잠금      ▲··(막힘)··       ▲··(막힘)··   실행 중 입력이 사라진다
```

### 선택 기준
| 상황 | 선택 | 이유 |
|---|---|---|
| 에디터 자동 저장 | **debounce** | 중간 본문은 의미 없고 마지막만 저장하면 된다 |
| 검색어 입력 → 조회 | **debounce** | 중간 검색어의 결과는 버려질 것 |
| scroll·resize·mousemove | **throttle** | 진행 중에도 반응해야 하지만 프레임마다는 과하다 |
| 무한 스크롤 트리거 | **throttle** | 멈출 때까지 기다리면 이미 늦다 |
| 체크박스·토글·버튼 | **둘 다 아님** | 클릭 1회 = 의도된 상태 변경 1회. 합치면 의도를 왜곡한다 |

**우리 앱의 실제 배치** — 같은 앱에 둘이 공존하는 이유가 여기 있다:
- 콜 메모 자동 저장 → **debounce 3초** (`NotesEditor.tsx`, [002](./002-debounce-autosave.md))
- Pre-trial 체크박스 → **아무것도 안 걸음** + scope 직렬화

### 잠금이 정당한 경우
`disabled` 자체가 나쁜 게 아니다. **되돌릴 수 없거나 멱등하지 않은 작업**은 막아야 한다 —
결제 요청, 메일 발송, 리소스 생성(중복 생성 위험). 판단 기준:

> 실패했을 때 **화면을 이전 상태로 되돌릴 수 있는가?**
> 되돌릴 수 있으면(=optimistic 가능) 잠그지 말고, 되돌릴 수 없으면 잠근다.

체크박스는 boolean 토글이고 전체 상태를 매번 보내는 멱등 쓰기라 되돌릴 수 있다 → 잠금 불필요.

### 왜 debounce 로 합치지 않았나
체크박스 연타를 debounce 로 묶으면 요청 수는 줄지만(4건 → 1건), 대가가 생긴다:
- 마지막 클릭 후 N ms 안에 창을 닫으면 **저장이 유실**된다([001](./001-page-unload-save.md) 문제를 새로 만든다).
- "체크했는데 저장이 안 됐다" 는 세일즈 현장에서 가장 비싼 실패다.

체크는 자주 연타하는 UI 가 아니므로(한 trial 당 3개, 통화 중 한 번씩) 실행 수 절감의 이득이 작다.
**요청 수 절감 < 유실 방지** 라 판단해 직렬화만 했다. 반대로 메모는 키 입력마다 요청이 나가면
n8n 실행이 수십 건이라 debounce 가 이득이 크다. *같은 기법이 어디서는 맞고 어디서는 틀리다.*

### 최소 구현
```ts
// debounce: 멈춘 뒤 1회 — clearTimeout 리셋이 본질
function debounce(fn, ms) {
  let t
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) }
}

// throttle: ms 마다 최대 1회 (첫 호출 즉시)
function throttle(fn, ms) {
  let last = 0
  return (...a) => { const now = Date.now(); if (now - last >= ms) { last = now; fn(...a) } }
}
```
React 에서는 타이머를 **ref** 에 두고 언마운트 cleanup 에서 정리한다([002](./002-debounce-autosave.md) 함정 1·2).

---

## 6. 다음에 "반응이 느리다" 를 만나면

1. **타이머를 찾기 전에 `disabled`·`readOnly`·`pointer-events` 를 본다.** 지연이 아니라 차단일 수 있다.
2. **왕복을 실측한다.** 0.1초와 0.7초는 완전히 다른 문제다(전자는 UI, 후자는 대기 은닉).
3. optimistic 이 있는데도 느리면 **낙관 갱신이 `await` 뒤에 있는지** 본다.
4. 잠금을 풀기 전에 **순서 보장 수단**을 먼저 준비한다(scope 직렬화 / 요청에 버전 태그 / 마지막 응답만 채택).
5. 고쳤으면 **가짜 느린 서버로 검증**한다. 실제 서버가 빠르면 회귀를 못 잡는다.

## 이 노트가 나온 작업
`frontend` `8a2e545` — `PreTrialCallCheckbox.tsx`(잠금 제거 + scope id 전달),
`usePreTrialCallCheckMutation.ts`(scope 파라미터, `onMutate` 순서 교정).
관련: [002](./002-debounce-autosave.md) 자동 저장 디바운스 · [003](./003-optimistic-update.md) optimistic·롤백·직렬화 ·
[001](./001-page-unload-save.md) 떠날 때의 저장.
