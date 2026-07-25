# 001. 페이지를 떠날 때의 저장 — `pagehide` · `fetch keepalive`

## 한 줄로
평범한 `fetch`의 수명은 **그 요청을 만든 문서에 묶여 있다.** 문서가 파괴되면(새로고침·탭 닫기·다른 사이트로 이동)
브라우저는 그 문서의 미완료 요청을 abort한다. `keepalive: true`는 "이 요청은 문서보다 오래 살아도 된다"는 표시다.

> ⚠️ 이름 주의: HTTP 헤더 `Connection: keep-alive`(TCP 연결 재사용)와 **아무 관계 없다.** 단어만 같다.

## 어떤 상황에서 쓰나
"떠나기 직전에 한 번 보내야 하는" 쓰기 — 자동 저장의 마지막 조각, 사용량 로그, 세션 종료 신호.

우리 사례: PTC 콜 메모는 입력이 멈춘 뒤 3초에 저장된다(→ [002](./002-debounce-autosave.md)).
그 3초 안에 새로고침하면 마지막 입력이 사라진다.

여기서 초보가 놓치는 사실이 두 개다.

1. **React는 페이지 unload 때 effect cleanup을 실행하지 않는다.** cleanup이 도는 건 컴포넌트 언마운트뿐이다.
   그래서 새로고침 시엔 저장 요청이 *중간에 끊기는* 게 아니라 **애초에 나가지도 않는다.**
2. 그래서 unload 시점을 잡아주는 이벤트(`pagehide`)와, 그 시점에도 살아남는 전송 수단(`keepalive`)이 **한 쌍**으로 필요하다.

`beforeunload`보다 `pagehide`를 쓴다 — 모바일·백그라운드 종료에서 `beforeunload`는 안 불리는 경우가 있다.

## 코드 요약

```ts
// 페이지가 사라지는 시점에 미저장분을 흘려보낸다.
useEffect(() => {
  const onHide = () => {
    const pending = pendingRef.current
    if (pending === null) return
    fetch("/api/trials/note", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trial_id: trialId, note: pending }),
      keepalive: true,          // ← 문서가 죽어도 이 요청만은 계속 전송된다
    })
  }
  window.addEventListener("pagehide", onHide)
  return () => window.removeEventListener("pagehide", onHide)
}, [trialId])
```

`navigator.sendBeacon(url, body)`는 사실 이것의 축약판(내부적으로 keepalive fetch)이지만 **POST 전용**이다.
우리 계약은 `PATCH`라서 쓸 수 없었다 — 메서드가 계약에 박혀 있으면 sendBeacon은 후보에서 빠진다.

## 함정

**"keepalive:false면 서버에 안 간다"는 정확하지 않다.** 보장이 없을 뿐, 타이밍에 따라 저장되기도 한다.

| 문서가 파괴된 순간의 상태 | 결과 |
|---|---|
| 요청이 아직 소켓에 안 나갔음 | 서버에 안 감 → 저장 안 됨 |
| 헤더·body 전송 중 끊김 | 서버가 불완전 요청으로 버림 → 저장 안 됨 |
| 서버가 이미 요청을 다 읽었음 | 서버는 정상 처리 → **저장 됨** (브라우저만 응답을 버린다) |

브라우저가 요청을 포기하는 것과 서버가 요청을 못 받는 것은 별개다. 그래서 이 경로에 부수효과를 걸면
**재현되지 않는 유실**이 생긴다 — 디버깅하기 가장 나쁜 종류의 버그다.

`keepalive: true`의 대가도 알아야 한다.
- **body 총합 64KiB 제한** — 동시 진행 중인 keepalive 요청 body 합이 이를 넘으면 `fetch` 자체가 실패한다.
- **응답을 읽을 수 없다** — 받아서 처리할 페이지가 이미 없다. 성공·실패를 알 방법이 없으므로
  optimistic 롤백·토스트를 붙일 수 없고, 재시도도 없다.
- 따라서 이건 **"놓치면 아까운 것"의 마지막 안전망**이지, 정상 저장 경로로 삼을 것이 아니다.

## 이 노트가 나온 작업
`frontend` — 콜 메모 자동 저장 배선(`1624483`) 및 임계값 조정(`9303372`) 논의 중.
`src/features/trials/components/NotesEditor.tsx`. (2026-07-25 시점 `pagehide` 배선 자체는 도입 보류 — 결정 대기)
