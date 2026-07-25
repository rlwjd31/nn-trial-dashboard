# 002. 디바운스 자동 저장과 언마운트 flush

## 한 줄로
디바운스 = "이벤트가 멈춘 뒤 N ms 지나면 한 번 실행". 타이머를 매 이벤트마다 리셋하는 것이 전부다.
자동 저장에 쓸 때는 **대기 중인 값이 사라지는 경로(언마운트·unload)를 반드시 함께 막아야** 한다.

## 어떤 상황에서 쓰나
"입력할 때마다" 실행하면 안 되는 부수효과 — 서버 저장, 검색 요청, 비싼 재계산.

우리 사례: MDXEditor의 `onChange`는 **스로틀되지 않아 키 입력마다 호출된다**(라이브러리 타입 주석이
"자동 저장을 할 거면 직접 스로틀하라"고 명시). 그대로 저장하면 글자당 PATCH 1건이 나간다.

임계값은 UX가 아니라 **쓰기 비용**으로 정했다. 저장 1회 = n8n 워크플로우 실행 1건(과금·쿼터 대상)이라,
처음 잡은 700ms는 "통화 중 끊어 쓰는" 패턴에서 메모 하나에 수십 건을 만들었다 → **3000ms**로 올렸다.
숫자를 정할 때 "얼마나 즉각적으로 느껴지나"만 보지 말고 **한 번의 저장이 무엇을 소비하는가**를 본다.

## 코드 요약

```tsx
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const pendingRef = useRef<string | null>(null)   // 아직 안 보낸 최신 본문

function handleChange(markdown: string) {
  pendingRef.current = markdown
  if (timerRef.current) clearTimeout(timerRef.current)   // ← 리셋이 디바운스의 본질
  timerRef.current = setTimeout(() => {
    timerRef.current = null
    pendingRef.current = null
    save(markdown)
  }, 3000)
}

// 디바운스 대기 중 언마운트되면(시트 닫기·다른 항목 선택) 마지막 입력이 유실된다 → 그때 흘려보낸다.
useEffect(() => {
  return () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const pending = pendingRef.current
    pendingRef.current = null
    if (pending !== null) saveRef.current?.(pending)
  }
}, [])
```

실물: `frontend/src/features/trials/components/NotesEditor.tsx`

## 함정

**1. cleanup에서 최신 값을 어떻게 읽는가.**
`useEffect(..., [])`의 cleanup은 **첫 렌더의 클로저**를 본다. 그 안에서 `props`/`state`를 읽으면 옛 값이다.
그래서 저장할 값은 `state`가 아니라 **ref**에 담아 cleanup이 최신을 읽게 한다. 호출할 함수(`mutate`)도
같은 이유로 ref 통로를 하나 두고, 그 ref는 **render 중이 아니라 effect 안에서** 갱신한다(render 중 ref 쓰기는 금지).

**2. deps에 함수를 넣으면 cleanup이 조기 실행된다.**
처음엔 `useEffect(() => flush, [flush])`로 썼다. `flush`의 정체성이 매 렌더 바뀌면 cleanup이 렌더마다 돌아
디바운스가 무력화된다. 이 프로젝트는 React Compiler를 쓰므로 실제로는 메모이즈되지만,
**정확성을 컴파일러 최적화에 의존하는 코드**가 되고 lint(`react-hooks/exhaustive-deps`)도 경고했다 →
ref 통로 + `deps: []` 로 바꿔 결정론을 확보했다. *"동작은 하지만 왜 동작하는지가 최적화에 달린 코드"는 고쳐라.*

**3. 언마운트는 막았지만 unload는 안 막힌다.** React는 페이지 unload 때 cleanup을 실행하지 않는다 → [001](./001-page-unload-save.md).

**4. 언마운트 후의 mutation은 정상 동작한다.** TanStack Query의 mutation은 컴포넌트가 아니라 캐시에 붙어 있어서,
cleanup에서 쏜 요청도 캐시 갱신·실패 토스트까지 정상 수행된다. (반대로 `setState`는 무시된다 — 화면이 없으니 당연하다)

## 이 노트가 나온 작업
`frontend` — `1624483`(배선) → `9303372`(700ms → 3000ms).
검증은 임시 Playwright 스펙으로 **실제 PATCH 횟수를 세어** 확인했다: 2.5초 연속 입력 = 0건, 정지 3.5초 후 = 1건,
디바운스 대기 중 Esc = 1건(flush). 이런 종류는 "될 것 같다"로 끝내지 말고 요청 수를 직접 센다.
