# 005. 브라우저 전용 외부 저장소와 `useSyncExternalStore`

## 한 줄로
React 밖에서 관리되는 값(localStorage, `window` 크기, 브라우저 API 상태)을 읽을 때는
`useEffect` + `setState`로 "복사해 오는" 대신 `useSyncExternalStore`로 **구독**한다.

## 어떤 상황에서 쓰나
서버 렌더링이 있는 앱에서 브라우저 전용 값을 읽어야 할 때. `localStorage`는 서버에 존재하지 않으므로
렌더 중 그냥 읽으면 SSR에서 터지고, effect로 읽으면 첫 페인트가 한 박자 늦어 깜빡인다.

```tsx
function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange)
  return () => window.removeEventListener("storage", onStoreChange)
}

const value = useSyncExternalStore(
  subscribe,                                   // ① 변경 알림 구독
  () => localStorage.getItem(key) ?? "",       // ② 클라이언트 스냅샷
  () => null,                                  // ③ 서버 스냅샷 — 서버엔 저장소가 없다
)
```

세 번째 인자(`getServerSnapshot`)가 SSR/hydration의 정답을 정한다. `null`을 주고 `value !== null`일 때만
해당 UI를 렌더하면 hydration 불일치를 원천적으로 피할 수 있다.

## 함정

**1. `storage` 이벤트는 값을 바꾼 그 탭에서는 발생하지 않는다.** 다른 탭·창에만 통지된다.
따라서 위 코드는 "같은 탭에서 내가 쓴 변경"은 감지하지 못한다. 같은 탭까지 반영하려면
쓰기 함수가 직접 리스너를 깨우는 층(커스텀 이벤트나 작은 store 객체)이 필요하다.
→ *구독 대상 이벤트가 내가 원하는 변경을 전부 알려주는지 확인하고 쓴다.*

**2. `getSnapshot`은 매번 같은 참조를 반환해야 한다.** 문자열·숫자는 문제없지만
객체/배열을 새로 만들어 반환하면 무한 렌더로 간다(캐시해서 반환할 것).

## 그런데 우리는 이 코드를 지웠다 — 그게 더 중요한 교훈이다

콜 메모는 처음엔 localStorage 임시 저장이었고, 위 훅으로 잘 구현돼 있었다.
그 다음 작업에서 서버 저장(`PATCH /api/trials/note` → `sales_note`)이 배선되자 이 훅은 **통째로 삭제**됐다.
메모의 주인이 브라우저에서 서버로 옮겨갔고, 서버 상태의 동기화는 TanStack Query가 이미 하고 있기 때문이다.

> **상태의 소유자가 바뀌면 동기화 도구도 바뀐다.**
> "어떤 훅을 쓸까"보다 "이 값의 단일 진실 공급원이 어디인가"가 먼저다.
> 잘 만든 코드를 지우는 것이 정답인 경우가 자주 있다.

두 저장소를 동시에 유지하는 선택(localStorage + 서버)은 특히 조심할 것 —
같은 값의 사본이 둘이 되는 순간 "어느 쪽이 진짜인가"를 매번 판단해야 한다.
예외는 [001](./001-page-unload-save.md)처럼 **유실 대비 안전망**으로 의도적으로 두는 경우인데,
그때도 "서버가 진짜, 로컬은 복구용"이라는 방향을 코드에 명시해야 한다.

## 이 노트가 나온 작업
`frontend` — `useSyncExternalStore` 버전은 `1624483`에서 서버 저장 배선으로 교체되며 제거됐다.

⚠️ 이 버전은 **커밋된 적이 없다**(작업 트리에만 있던 상태에서 교체됨) → git 히스토리에서 복구할 수 없다.
`1624483^` 에 남아 있는 것은 그 이전 단계인 `useEffect` + `useState` 버전이다. 실물을 여기 보존한다:

```tsx
/** 다른 탭에서의 변경까지 반영하도록 storage 이벤트를 구독한다. */
function subscribeToStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange)
  return () => window.removeEventListener("storage", onStoreChange)
}

export function NotesEditor({ trialId }: Props) {
  const storageKey = trialId ? `ptc-note:${trialId}` : null

  // localStorage 는 브라우저 전용 외부 저장소 → effect+setState 대신 구독한다.
  // 서버 스냅샷은 null → SSR/hydration 시엔 에디터를 렌더하지 않는다.
  const initial = useSyncExternalStore(
    subscribeToStorage,
    () => (storageKey ? (localStorage.getItem(storageKey) ?? "") : ""),
    () => null,
  )

  function handleChange(markdown: string) {
    if (storageKey) localStorage.setItem(storageKey, markdown)
  }

  return /* … initial !== null 일 때만 <Editor markdown={initial} …/> … */
}
```

*교훈 하나 더: 커밋하지 않은 작업은 언제든 사라질 수 있다. 방향을 바꾸기 전에 커밋해두면 되돌릴 선택지가 남는다.*
