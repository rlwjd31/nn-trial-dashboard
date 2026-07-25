# 013. 조상이 만든 컨텍스트가 자식 CSS 를 조용히 무력화한다 — sticky · backdrop-filter

## 한 줄로
`position: sticky` 와 `backdrop-filter` 는 **자기 스타일만 보면 맞게 썼는데도 아무 일도 안 일어날 수** 있다.
둘 다 **조상이 만든 컨텍스트**(스크롤포트 / backdrop root)를 기준으로 동작하기 때문이다.
`!important` 나 값을 키우는 것으로는 절대 해결되지 않는다 — **조상을 고쳐야 한다.**

## 어떤 상황에서 쓰나
표 헤더 고정, 사이드바 고정, 유리(frosted) UI. 즉 대시보드에서 거의 항상.

---

## 사례 1 — sticky 가 "먹지 않는" 이유: 기준이 뷰포트가 아니다

`position: sticky` 는 **가장 가까운 스크롤 컨테이너(scrollport)** 를 기준으로 붙는다. 뷰포트가 아니다.
그리고 **`overflow` 가 `visible` 이 아닌 조상은 스크롤 컨테이너가 된다.**

우리 표의 구조가 이랬다:

```
div.glass.overflow-hidden                ← ① 스크롤 컨테이너가 됨
└ div[data-slot=table-container].overflow-x-auto   ← ② 여기도 스크롤 컨테이너
  └ table > thead > th  (sticky top-0)   ← ②를 기준으로 붙는다 = 아무 효과 없음
```

②는 높이가 콘텐츠에 맞춰져 있어 **세로로 스크롤되지 않는다.** 스크롤되지 않는 컨테이너에 sticky 를 붙이면
"붙을 일" 이 생기지 않으므로 그냥 정적으로 보인다. 코드는 맞는데 화면은 그대로다.

**덤으로 알아둘 것**: `overflow-x: auto` 만 지정해도 `overflow-y` 의 `visible` 은 **`auto` 로 계산된다**(CSS 스펙).
한 축만 건드렸다고 생각해도 양축 스크롤 컨테이너가 된다 — shadcn `Table` 의 래퍼가 정확히 이 경우다.

### 해결: 스크롤 컨테이너를 내가 정한다
"어디가 스크롤되어야 하는가" 를 먼저 정하고, 그 요소만 스크롤 컨테이너로 만든다.

```tsx
// 표 영역이 스크롤 컨테이너 = thead 의 sticky 기준
<div className={cn(
  "glass rounded-lg",
  "h-full overflow-auto",                                   // ← 여기가 scrollport
  "[&>[data-slot=table-container]]:overflow-visible",       // ← 내부 래퍼는 무력화
)}>
  <Table>
    <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10">
```

- `overflow-hidden` 은 필요 없다 — **`overflow-auto` 도 `border-radius` 로 클리핑한다.**
- 껍데기(`html`/`body`/`main`)를 뷰포트 높이에 고정하고 `flex-1 min-h-0` 으로 남은 높이를 표에 넘겨야
  표 영역에 "스크롤할 높이" 가 생긴다. **`min-h-0` 을 빼면 flex 자식이 콘텐츠 높이만큼 부풀어
  내부 스크롤이 아예 생기지 않는다** (flex item 의 `min-height: auto` 기본값 때문).

### 왜 `th` 에 sticky 를 걸었나
`thead`/`tr` 에 걸어도 최신 브라우저는 동작하지만, **배경이 문제가 된다.**
sticky 로 움직이는 주체가 `th` 이면 `tr` 의 배경은 따라오지 않아 **지나가는 행이 그대로 비친다.**
`th` 에 sticky + 배경을 함께 주는 것이 가장 예측 가능하다.

---

## 사례 2 — `backdrop-filter` 가 "먹지 않는" 이유: backdrop root

위 헤더에 `backdrop-filter: blur(22px)` 를 줬는데 **아래로 지나가는 행이 선명하게 비쳤다.**
값을 키워도(48px, 80px) 전혀 달라지지 않았다. 원인:

> `backdrop-filter`(그리고 `filter`, `opacity < 1`, `mask` 등)를 가진 요소는 **backdrop root** 를 만든다.
> 그 안쪽 자손의 `backdrop-filter` 는 **backdrop root 뒤에 있는 것만** 블러 대상으로 삼는다.
> **같은 root 안의 형제·조상 콘텐츠(= 스크롤되는 행)는 대상에서 빠진다.**

우리 래퍼가 `.glass`(= `backdrop-filter: blur() saturate()`)였으므로, 그 안의 `th` 가 아무리 세게 블러해도
**같은 컨테이너 안의 행은 흐려질 수 없었다.** 값의 문제가 아니라 위치의 문제다.

### 해결: 블러를 어디서 쓸지 하나만 고른다
중첩된 두 유리 표면 중 **한쪽의 `backdrop-filter` 를 포기**해야 한다. 우리는 이렇게 갈랐다:

```tsx
// 래퍼: 배경색·테두리·그림자는 유지, backdrop-filter 만 끈다
"glass rounded-lg h-full overflow-auto [backdrop-filter:none]"

// 헤더: 색은 유리 톤 유지 + 강한 blur → 지나가는 행이 녹는다
"[&_th]:bg-glass-strong [&_th]:[backdrop-filter:blur(48px)_saturate(180%)]"
```

**판단 근거**: 래퍼 뒤에 있는 것은 매끄러운 그라디언트 배경이다. 그라디언트는 블러해도 거의 똑같이 보인다
→ 래퍼의 블러는 시각적 기여가 거의 없다. 반면 헤더 뒤로는 **글자가 지나간다** → 블러가 결정적이다.
*"둘 다 유리로 보이게" 가 아니라 "블러가 실제로 하는 일이 있는 쪽" 에 준다.*

### 대안과 그 대가
| 방법 | 대가 |
|---|---|
| 헤더를 **불투명색**으로 (`oklch(0.30 0.045 292)`) | 확실하지만 유리 질감이 사라진다. 실제로 만들어 비교한 뒤 기각 |
| 래퍼 blur 유지 + 헤더 alpha 0.92~0.97 | 3~8% 만큼 글자가 계속 유령처럼 남는다(실측) |
| **래퍼 blur 포기 + 헤더 강한 blur** ✅ | 래퍼의 배경 블러를 잃지만 그라디언트라 티가 안 난다 |

blur 강도도 감으로 정하지 않았다 — 24 / 48 / 80px 를 렌더해 비교했고 24px 는 밝은 얼룩이 남아 **48px** 로 정했다.

---

## 함정 정리

1. **"안 먹으면 값을 키운다" 는 거의 항상 틀린 대응이다.** sticky·backdrop-filter 는 조상 컨텍스트 문제라
   값·`!important` 로 뚫리지 않는다. **DevTools 로 조상을 위로 훑어 `overflow` 와 `backdrop-filter`/`filter`/`opacity` 를 찾는다.**
2. `overflow-x: auto` 는 **양축** 스크롤 컨테이너를 만든다.
3. flex 안에서 내부 스크롤을 만들려면 **`min-h-0`** 이 거의 항상 필요하다.
4. sticky 요소는 **자기 배경을 가져야** 한다. 조상(`tr`)의 배경은 따라오지 않는다.
5. **z-index 를 잊지 말 것** — sticky 는 겹침 순서를 자동으로 올려주지 않는다(`z-10`).
6. 이런 종류는 **스크린샷으로 검증**해야 한다. 단위 테스트로는 "블러가 실제로 글자를 가렸는가" 를 알 수 없다.
   좌표 단언(스크롤 후 `boundingBox().y` 가 그대로인가)은 sticky 회귀 방지에 쓸 수 있다.

## 어떻게 검증했나
Playwright 로 표 영역만 스크롤시키고 좌표·스크롤 상태를 단언 + 헤더 주변을 크롭해 후보를 눈으로 비교했다.

```ts
await pane.evaluate((el) => el.scrollBy(0, 900));
expect(await page.evaluate(() => window.scrollY)).toBe(0);        // 문서는 안 움직임
expect((await th.boundingBox())?.y).toBe(thYBefore);              // 컬럼 헤더 고정
expect(await pane.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);  // 가로 스크롤은 살아있음
```

## 이 노트가 나온 작업
`frontend` `4d7a8d7` — `layout.tsx`(body `h-full`), `TrialsDashboard.tsx`(flex + `min-h-0`),
`TrialsTable.tsx`(스크롤 컨테이너 지정 · 내부 래퍼 무력화 · `th` sticky + blur).
관련: [012](./012-debounce-throttle-inflight-lock.md) — 거기서도 "증상의 원인이 의심한 곳이 아니었다" 가 핵심이었다.
