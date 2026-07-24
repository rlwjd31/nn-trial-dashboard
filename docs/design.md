# DESIGN.md — Trial Dashboard

프론트엔드의 **디자인 + 설계 단일 진실 공급원(Single Source of Truth)**.
이 문서는 두 가지를 정의한다.
1. **디자인** — 어떻게 보이고 느껴져야 하는가 (철학 · 토큰 · 컴포넌트)
2. **프론트엔드 설계** — 코드를 어떻게 구조화하는가 (컴포넌트 · 상태 · 데이터 경계)

> 제품 요구/화면 스펙은 [PRD.md](./PRD.md). 이 문서는 그 "어떻게"를 정의한다.
> 이 파일은 `CLAUDE.md`가 `@docs/design.md`로 import → 매 세션 자동 로드된다.

---

## 0. 이 문서 사용법 (AI 지침)

UI·스타일·컴포넌트 작업 **전에** 이 문서를 먼저 읽는다. 그리고 아래 판단 절차를 따른다.

1. **먼저 토큰/레시피에 답이 있는지 본다** (§3, §4, §6). 있으면 그대로 쓴다 — 새로 짓지 않는다.
2. **없으면 원칙(§2)과 설계 규칙(§5)으로 유추**하되, 그 선택의 **이유(WHY)를 말할 수 있어야** 한다.
3. **여전히 모호하면 임의로 정하지 말고 사용자에게 확인**한다 (특히 새 색상 hue, 새 컴포넌트 도입, 레이아웃 골격 변경).
4. 작업 후 **§7 체크리스트**로 자가검증한다.

> 핵심 철학 한 줄: **"모든 시각적·구조적 선택은 의도적이어야 한다. 이유를 말할 수 없는 선택은 하지 않는다."**
> 서로 다른 프롬프트에 매번 똑같은 결과(sameness)가 나온다면 그것은 craft의 실패 신호다.

---

## 1. 스택 (있는 그대로 사용 — 새 라이브러리 도입 금지)

| 영역 | 도구 | 메모 |
|---|---|---|
| 프레임워크 | **Next.js 16 App Router** (RSC 기본) | Next API는 관례가 다를 수 있음 → **AGENTS.md** 지시대로 `node_modules/next/dist/docs/` 확인 후 작성 |
| CSS 엔진 | **Tailwind v4** | CSS-first. `tailwind.config.js` 없음. 토큰은 `src/app/globals.css`의 `@theme inline` |
| 컴포넌트 | **shadcn v4** (`style: base-nova`, baseColor `neutral`) | `src/components/ui/*` 에 소스로 존재 → 직접 소유·수정 |
| 프리미티브 | **Base UI** (`@base-ui/react`) | ⚠️ Radix 아님. 새 프리미티브도 Base UI로 |
| 테마 | **next-themes** | `.dark` 클래스 토글. `@custom-variant dark (&:is(.dark *))` |
| 서버 상태 | **TanStack Query v5** | 캐싱 + optimistic update. 클라이언트 데이터 페칭의 유일 경로 |
| 아이콘 | **lucide-react** | 유일한 아이콘 소스 |
| Toast | **sonner** | 에러/롤백 알림 |
| 변형 | **cva** (class-variance-authority) | 컴포넌트 variant |
| 클래스 병합 | **`cn()`** (`@/lib/utils`) | className 조합은 항상 `cn()` 경유 |
| 애니메이션 | **tw-animate-css** | `animate-in` / `fade-in` 등 |

색은 전부 **oklch**, `--color-*` CSS 변수로 관리. 현재 팔레트는 **무채색(neutral)** — 브랜드 hue 없음.

---

## 2. 디자인 철학 (WHY — 모호할 때의 판단 기준)

### 컨셉
- **Modern + Glassmorphism, 다크 기본.** 어두운 gradient 배경 위에 반투명 유리 표면을 얹어 깊이를 만든다.
- **정체성**: 차분하고 정밀한(cold-and-precise) 내부 도구. 화려함이 아니라 **정보 파악 속도**가 목적.

### 원칙 (leading practice 기반)
1. **의도성** — 레이아웃·색온도·간격·위계 모든 선택에 이유가 있어야 한다.
2. **gray는 구조, color는 의미** — 무채색으로 뼈대를 세우고, 색은 "의미 있는 것"에만 (상태·경고·활성).
3. **하나의 의도적 accent > 여러 무의미한 accent** — 강조는 아껴 쓴다. 화면당 강조 포인트는 소수.
4. **whisper-quiet elevation** — 깊이는 은은하게. 극적인 드롭섀도우 금지 (§2 안티패턴).
5. **일관성이 곧 시스템** — 같은 개념은 항상 같은 토큰/간격/컴포넌트로. 제각각인 간격은 "시스템 없음"의 가장 명백한 신호.
6. **타이포가 디자인이다** — 위계(크기·굵기·명도 대비)로 정보를 읽히게 한다. 한 화면에 굵기 2종 이하 권장.
7. **데이터 표현은 의미를 담는다** — 같은 수치도 표현 방식(숫자 vs 진행률 vs 배지)에 따라 다른 이야기를 한다. PRD 카드/상태는 "판독 속도" 우선으로 표현.

### 무드
- 배경: **딥 바이올렛(퍼플) 단일 계열 그라데이션**(hue 285~300, 깊고 차분하게 · 네온 금지).
  상단 광원 + 아래로 어두워지는 명도 변화. 단색 흰/검, 다색 blob(촌스러움) 모두 지양.
  유리 효과는 배경의 화려함이 아니라 **표면 자체(edge 하이라이트·blur·shadow) + 뒤 오브 프로스팅**으로 낸다.
- 표면: 반투명 프로스티드 유리(§3.2). 위로 갈수록 blur·명도↑. `saturate`로 뒤 색을 끌어올린다.
- 여백: 넉넉하게. 답답함보다 여유. 단, 표는 데이터 밀도를 확보.

---

## 3. 디자인 토큰

### 3.1 기존 시맨틱 토큰 (globals.css에 이미 존재 — 그대로 사용)
임의 hex/oklch를 tsx에 직접 박지 않는다. 아래 유틸리티만 쓴다.

| 의도 | 유틸리티 | 용도 |
|---|---|---|
| 바탕/텍스트 | `bg-background` `text-foreground` | 페이지 기본 |
| 카드 | `bg-card` `text-card-foreground` | 카드 표면 |
| 주요 액션 | `bg-primary` `text-primary-foreground` | CTA |
| 보조 | `bg-secondary` `text-secondary-foreground` | 보조 요소 |
| 부가 텍스트 | `text-muted-foreground` | 라벨·캡션 |
| hover 강조 | `bg-accent` `text-accent-foreground` | 상호작용 강조 |
| 위험/에러 | `bg-destructive` `text-destructive` | 삭제·실패 |
| 경계/포커스 | `border-border` `ring-ring` | 구분선·포커스 링 |
| 시각화 | `bg-chart-1`…`chart-5` | 차트(현 그레이 스케일) |

- **Radius**: `--radius: 0.625rem` 파생 → `rounded-sm/md/lg/xl/2xl/3xl/4xl`. **글래스 표면은 `rounded-2xl` 이상**.
- **타이포**: `--font-sans`(기본), `--font-mono`(수치·ID), `--font-heading`.
- **수치 정렬**: 카운트·시간 등 숫자는 `tabular-nums`.

### 3.2 Glassmorphism 토큰 (✅ globals.css에 구현 완료)
아래 토큰이 `globals.css`에 정의되어 있고, 빌드로 유틸리티 생성이 검증됨.
컴포넌트는 개별 값을 다루지 말고 **`.glass` / `.glass-strong` 클래스만** 쓴다.

**표면 계층(elevation) 모델** — 컴포넌트는 깊이에 맞는 표면을 고른다.
| 계층 | 클래스 | 용도 |
|---|---|---|
| L0 배경 | (body gradient) | 페이지 최하단, **딥 바이올렛 단일 계열 그라데이션** + 동일 계열 오브 |
| L1 기본 표면 | **`.glass`** | 카드, 표 컨테이너 등 일반 표면 |
| L2 상위 표면 | **`.glass-strong`** | Sheet(상세)·팝오버·표 헤더 등 가독성 필요한 떠 있는 표면 |

**생성 유틸리티** (직접 조합이 필요할 때만): `bg-glass` `bg-glass-strong`
`border-glass-edge` `border-glass-edge-strong` `shadow-glass` `backdrop-blur-glass`.

**토큰 값** (다크=기본 / 라이트=대비용 최소값):
| 토큰 | dark | light | 역할 |
|---|---|---|---|
| `--glass` | `oklch(1 0 0 / 10%)` | `oklch(1 0 0 / 55%)` | L1 표면 배경 |
| `--glass-strong` | `oklch(1 0 0 / 16%)` | `oklch(1 0 0 / 72%)` | L2 표면 배경 |
| `--glass-edge` | `oklch(1 0 0 / 28%)` | `oklch(0.145 0 0 / 8%)` | 테두리(기본) |
| `--glass-edge-strong` | `oklch(1 0 0 / 42%)` | `oklch(0.145 0 0 / 12%)` | 테두리(강) |
| `--glass-blur` | `22px` | `16px` | backdrop blur 강도 |
| `--glass-shadow` | `0 12px 40px …/45%` + inset 상단 하이라이트 2겹 | `…/12%` + inset | 소프트 그림자 + 유리 상단 광택 |

- `--glass-shadow`의 **inset 하이라이트**(`inset 0 1px 0 0 oklch(1 0 0 / 28%)`)가 유리 윗변에 빛
  반사를 만들어 "진짜 유리" 질감을 낸다. `.glass` 계열이면 자동 적용됨.
- `.glass`/`.glass-strong` 은 `backdrop-filter: blur() saturate(180%)` 를 **명시 선언**한다
  (유틸 @apply 아님) — saturate 로 뒤 blob 색을 끌어올려 프로스티드 느낌을 강화.
- body gradient가 있어야 blur가 보인다. **딥 바이올렛 베이스 + 동일 계열(285~300) 소프트 광원
  오브 1~2개**를 카드/테이블 '뒤'에 배치 → backdrop-blur 가 실제로 프로스팅할 대상이 생겨
  "확실한 유리"가 된다. 다색·네온·고채도는 촌스럽고 가독성을 해치므로 금지(전 레이어 단일 계열).
- ⚠ **shadcn `<Card>`/`<SheetContent>` 함정**: 이들은 불투명 `bg-card`/`bg-popover` 를
  갖고 있어 `.glass` 의 반투명 배경을 **덮어써서 유리가 사라진다**. 유리 표면은
  plain `<div className="glass">` 를 쓰거나(권장), 불가피하면 `!bg-glass`/`!bg-glass-strong`
  important 유틸로 배경을 강제 override 한다(Tailwind v4 → **접미사** `bg-glass!` 문법). (§4 레시피 참조)

정의 위치: `globals.css`의 `:root`/`.dark`(값) · `@theme inline`(유틸 매핑) · `@layer base`(body gradient) · `@layer components`(`.glass`/`.glass-strong`).

### 3.3 모션
- 빠른 상호작용 **150ms**, 표준 전환 **300ms**. `transition-colors`/`duration-300`.
- 진입: `animate-in fade-in slide-in-from-* duration-300` (tw-animate-css).
- 과한 모션 금지 — 정보 도구다. 바운스·긴 지연 지양.

---

## 4. 컴포넌트 카탈로그 (레시피)

설치된 shadcn 컴포넌트를 베이스로, 글래스는 className으로 덧입힌다. **없는 컴포넌트를 raw HTML로 새로 만들지 않는다.**

### 4.1 GlassCard (대시보드 상단 카드)
⚠ shadcn `<Card>` 는 불투명 `bg-card` 때문에 유리가 사라진다(§3.2 함정). **plain `<div className="glass">` 를 쓴다.**
```tsx
<div className={cn("glass rounded-2xl px-4 py-4 flex flex-col gap-1")}>
  <p className="text-xs font-medium text-muted-foreground">Today's trials</p>
  <p className="font-heading text-4xl font-semibold tabular-nums text-foreground">{count}</p>
</div>
```
상단 4카드(Today's / Pre-call done / Post-call done / Converted) 동일 레시피, 수치만 교체. 그리드 `grid-cols-2 lg:grid-cols-4 gap-3`.

### 4.2 Data Table (목록)
컨테이너만 글래스. **표 셀에는 blur/반투명 남용 금지**(가독성).
```tsx
<div className={cn("glass rounded-2xl overflow-hidden")}>
  <Table>
    <TableHeader className="bg-glass-strong">…</TableHeader>
    <TableBody>
      <TableRow className="cursor-pointer hover:bg-accent/40 transition-colors">…</TableRow>
    </TableBody>
  </Table>
</div>
```

### 4.3 Badge (Mentor tier / Status)
무채색 팔레트 → tier/status는 **색보다 명도·형태**로 구분.
```tsx
<Badge variant={tier === "elite" ? "default" : "secondary"}>{tier}</Badge>
```
status는 `cva`로 tone 정의(neutral/active/done/warn). 실제 status 값 목록은 **PRD §9 미확정** → 확정 후 tone 매핑 표를 여기 추가.

### 4.4 Pre-trial Checkbox (1·2·3, optimistic)
```tsx
<Checkbox
  checked={checked} disabled={isPending}
  onCheckedChange={(v) => mutate({ trial_id, stage, checked: !!v })}
  onClick={(e) => e.stopPropagation()}   /* 행 클릭(상세) 전파 차단 */
  className={cn(isPending && "opacity-60 animate-pulse")}
  aria-label={`Pre-trial ${stage}`}
/>
```
성공 유지 / 실패 시 캐시 롤백 + sonner 에러 토스트(§4.6).

### 4.5 Detail Panel (행 클릭)
`Sheet` 우측 슬라이드. 판독 목적 → `glass-strong`(대비 강).
⚠ `<SheetContent>` 는 불투명 `bg-popover` 를 가지므로 `bg-glass-strong!` important(Tailwind v4 접미사) 로 배경을 강제 override 해야 유리가 보인다(§3.2 함정).
```tsx
<SheetContent side="right" className={cn("glass-strong bg-glass-strong! sm:max-w-md")}>
  <SheetHeader><SheetTitle>Trial detail</SheetTitle></SheetHeader>
  {/* student_id·email·phone·level·mentor(id/name/gender)·interests·trial_date */}
  <Separator className="bg-glass-edge my-4" />
  {/* CloudTalk 클릭 발신 (ct+tel:). call_queue_url 대체 — docs/cloudtalk-call-button.md */}
  <CloudTalkCallButton targetNumber={detail.student_phone_number} />
</SheetContent>
```
`interests`는 Badge 나열.

### 4.6 CloudTalk 발신 버튼
`ct+tel:` 딥링크 → CloudTalk 데스크톱 앱 발신. **번호는 E.164 필수**(`toE164` 정규화 선행).
Base UI `Button` 을 앵커로 렌더하므로 `render={<a … />}` + `nativeButton={false}`.
전체 스펙: [cloudtalk-call-button.md](cloudtalk-call-button.md).
```tsx
<Button className="w-full" nativeButton={false}
  render={<a href={`ct+tel:${encodeURIComponent(toE164(targetNumber))}`} />}>
  <PhoneIcon /> 전화 걸기
</Button>
```

### 4.7 PTC 콜 메모 (Markdown)
마크다운 작성 → 자동 렌더. 1순위 `@uiw/react-md-editor`(라이브 프리뷰, 클라 전용 →
`next/dynamic` `{ ssr:false }`), 대안 `react-markdown` + `Textarea` + Write/Preview 탭.
유리 위 내부 표면이므로 배경 투명 + 얇은 구분선(중첩 유리 지양). 전체 스펙: [ptc-call-notes.md](ptc-call-notes.md).
```tsx
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });
// <div data-color-mode="dark"><MDEditor value={content} onChange={setContent} /></div>
```

### 4.8 상태(Loading / Empty / Error)
- **Loading**: `Skeleton`으로 행 placeholder.
- **Empty**: "오늘 예정된 trial이 없습니다" + lucide 아이콘 1개, `text-muted-foreground`, 중앙 정렬.
- **Error/롤백**: `sonner` — `toast.error("체크 저장 실패 — 되돌렸습니다")`.

---

## 5. 프론트엔드 설계 원칙 (코드 구조)

### 5.1 서버/클라이언트 경계 (App Router · RSC)
- **기본은 Server Component.** 상호작용(state·effect·이벤트·TanStack Query)이 **필요한 최소 단위**에만 `"use client"`.
- `"use client"`는 트리 상단에 광범위하게 걸지 말고 **잎(leaf)에 가깝게** 내린다.
- 민감정보/토큰은 서버에만. 브라우저 번들에 `N8N_*` 노출 금지(PRD §3). 프론트는 자기 도메인 `/api/*`만 호출.
- ⚠️ Next 16 API 세부는 관례가 다를 수 있음 → 코드 작성 전 **AGENTS.md** 지시대로 로컬 docs 확인.

### 5.2 데이터 레이어 (TanStack Query)
- 클라이언트 서버상태는 **전부 TanStack Query**. 수동 `fetch`+`useEffect`+`useState` 조합 금지.
- **queryKey 규약**: `["trials"]`(목록), `["trial", id]`(상세). 키는 배열·직렬화 가능하게.
- 목록: `staleTime: 60_000`, `refetchOnWindowFocus: true`(PRD §5).
- 체크박스: **optimistic update** — `onMutate`에서 캐시 즉시 수정 + 스냅샷, `onError`에서 롤백 + toast, `onSettled`에서 필요 시 invalidate. (PRD §5 준수: 성공 시 불필요한 재조회로 n8n 호출 늘리지 않기)
- 서버 캐시 no-store는 Route Handler 책임(PRD §8). 프론트는 관여 안 함.

### 5.3 컴포넌트 설계
- **Composition over configuration** — props를 수십 개 받는 만능 컴포넌트 대신, 작은 컴포넌트 조합. `children`/slot 활용.
- **컴포넌트를 언제 분리?** 재사용 2회↑, 또는 한 파일이 한 화면에서 인지부하가 큰 경우. 성급한 추상화 금지(YAGNI).
- **변형은 cva로.** 조건부 className을 if로 흩뿌리지 않는다.
- **className 확장 허용**: 재사용 컴포넌트는 `className?` prop을 받아 `cn(base, className)`로 병합.
- shadcn 컴포넌트가 부족하면 **먼저 그 소스(`components/ui/*`)를 수정/확장**한다. 병행 구현 금지.

### 5.4 상태 관리
- **로컬 UI 상태**(열림/선택 등)는 `useState`로 컴포넌트 안에 **colocate**. 전역 스토어 도입 금지(MVP 비목표).
- **서버 상태**는 TanStack Query가 소유. 서버 데이터를 `useState`로 복제하지 않는다.
- 파생값은 렌더 중 계산(대시보드 카드 수치 = 목록 데이터 집계, PRD §6.1). 별도 상태로 두지 않는다.

### 5.5 파일·네이밍 규약
- alias 사용: `@/components` `@/lib` `@/hooks` `@/components/ui`(components.json 기준).
- 타입은 `@/types`(예: `trial.ts`)에 모으고 API 응답 계약을 여기 반영.
- API 프록시는 `src/app/api/**/route.ts`, n8n 호출 로직은 `@/lib/n8n`, 클라이언트 fetch 래퍼는 `@/lib/api`.
- 컴포넌트 파일 PascalCase, 훅 `useX`, 유틸 camelCase.

### 5.6 접근성 & 품질
- 대화형 요소는 실제 `<button>`/`Checkbox` 등 시맨틱 요소 사용(클릭 가능한 `div` 지양).
- 반투명 위 텍스트 **WCAG AA 대비** 확보 — 부족하면 `glass-strong`.
- 포커스 링(`ring-ring`) 제거 금지. 키보드 내비게이션 유지.
- 아이콘 단독 버튼엔 `aria-label`.
- 이미지/아이콘 의미 없으면 `aria-hidden`.

---

## 6. 레이아웃 골격
- 컨테이너 `max-w-7xl mx-auto px-6 py-8` (데스크톱 내부 도구, 모바일 최적화는 비목표).
- 위계: 상단 카드 4열 → 목록 표 → (행 클릭) 우측 Sheet.
- 깊이: 배경 gradient(최하) → 표 `.glass`(중) → Sheet `.glass-strong`(최상). 위로 blur·명도↑.
- 여백: 카드 내부 `p-6`, 카드 간 `gap-4~6`, 섹션 간 `space-y-8`.

---

## 7. 안티패턴 (항상 틀림)

**디자인**
- ❌ 극적인 드롭섀도우(`shadow-2xl` 남발, `0 25px 50px …`) — 싸구려로 보인다. whisper-quiet만.
- ❌ 임의 alpha 남발(`bg-white/8`,`/10`,`/12`…) → `.glass`/`.glass-strong` 토큰으로 통일.
- ❌ 하드코딩 hex/oklch를 className/`style`에 직접 삽입.
- ❌ 단색 배경 위 글래스(블러가 안 보임 → 그냥 카드 쓸 것).
- ❌ 데이터 밀도 높은 표 셀에 blur/반투명 남용.
- ❌ 두꺼운 장식용 border(2px+), 비대칭 임의 padding, border와 shadow를 무원칙 혼용.
- ❌ 이유 없는 다중 accent 색. 한 화면 굵기 3종+.

**코드/설계**
- ❌ Radix import (이 프로젝트는 Base UI).
- ❌ 새 UI/상태/스타일 라이브러리 임의 도입(MVP 비목표).
- ❌ 수동 `fetch`+`useEffect` 데이터 페칭(→ TanStack Query).
- ❌ 서버 데이터를 `useState`로 복제, 전역 스토어 도입.
- ❌ `"use client"`를 트리 상단에 광범위하게.
- ❌ `N8N_*` 등 서버 시크릿을 클라이언트에 노출(`NEXT_PUBLIC_` 금지).
- ❌ shadcn 컴포넌트 있는데 raw HTML 재구현.
- ❌ 인라인 `style={{}}`(동적 계산값 예외).

---

## 8. 체크리스트 (UI PR 전 자가검증)
- [ ] 이 선택의 **이유(WHY)** 를 말할 수 있는가 (§2 의도성)
- [ ] 색/간격/radius를 **토큰·유틸리티**로만 썼는가 (하드코딩 없음)
- [ ] 글래스 표면은 `.glass`/`.glass-strong` 로 통일했는가
- [ ] className은 `cn()`, variant는 `cva`로 처리했는가
- [ ] 서버상태는 TanStack Query, 로컬상태는 colocate 했는가 (§5.2, §5.4)
- [ ] `"use client"`를 필요한 최소 leaf에만 걸었는가
- [ ] 서버 시크릿이 클라이언트에 노출되지 않는가
- [ ] 다크(`.dark`)에서 텍스트 대비(AA)·포커스 링을 확보했는가
- [ ] 시맨틱 요소·`aria-label`을 썼는가
- [ ] Loading(Skeleton)·Empty·Error(sonner)를 처리했는가
- [ ] 기존 shadcn 컴포넌트를 재사용/확장했는가 (raw 재구현 아님)
