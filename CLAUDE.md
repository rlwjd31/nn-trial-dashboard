# CLAUDE.md — frontend 도메인

이 파일은 `frontend` 워크트리(= `trial-dashboard/frontend/`) **전용** 규칙이다.

> **공용 규칙은 상위 `../CLAUDE.md`(main 워크트리)가 갖고 있고, 이 폴더에서 세션을 열면 자동으로 함께 로드된다.**
> 저장소 구조 · 브랜치 경계 · 계약 변경 알림 프로토콜 · Product Spec · 커밋 규약은 전부 거기 있다 —
> **여기에 복사하지 말 것** (사본이 둘이 되면 어느 쪽이 진짜인지 알 수 없게 된다).
> `AGENTS.md` · `docs/**` 도 상위에만 있다 → `../AGENTS.md` · `../docs/**`.
> 아래 본문의 `docs/…` 표기는 모두 그 상위 사본을 가리킨다.

# Commands

패키지 매니저는 **pnpm** 고정.

```bash
pnpm dev                     # 개발 서버 (http://localhost:3000)
pnpm build                   # 프로덕션 빌드
pnpm lint                    # eslint (flat config, eslint-config-next)
pnpm test:e2e                # Playwright E2E 전체 (가이드: docs/testing.md)

# 단일 테스트
pnpm exec playwright test e2e/precheck.spec.ts
pnpm exec playwright test e2e/precheck.spec.ts -g "체크박스"
pnpm exec playwright test --headed --debug            # 디버깅
pnpm exec playwright install chromium                 # 첫 실행/버전 업 시 브라우저 설치
pnpm exec playwright show-trace test-results/**/trace.zip   # 실패 원인 추적
```

- 타입체크 전용 스크립트는 없다 → `pnpm build` 또는 `pnpm exec tsc --noEmit`.
- Playwright `webServer` 가 `pnpm dev` 를 자동 기동하고 `reuseExistingServer: true` 이므로,
  켜둔 dev 서버가 있으면 재사용한다. `.env.local` 을 바꿨으면 **dev 서버를 재시작**해야 반영된다.

# Architecture

## 요청 경로 (단방향)

```
components ─→ hooks (TanStack Query) ─→ @/lib/api ─→ src/app/api/**/route.ts ─→ @/lib/n8n ─→ n8n webhook ─→ Cloud SQL
  useTrials/useTrialDetail/           브라우저 fetch    서버 경계(프록시)       "server-only" + n8nPaths
  usePreTrialCallCheckMutation/       (자기 도메인만)   force-dynamic          (webhookId 조립)
  useNoteMutation
```

- 역방향 import 금지. 브라우저 코드는 **자기 도메인 `/api/*` 만** 호출하고 n8n URL·토큰을 모른다.
- `@/lib/n8n` 은 `import "server-only"` 가드 + `requireEnv()` 로 env 누락 시 즉시 throw.
- 폴더 배치 규칙·결정 트리는 [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) (feature-lite: 도메인은 `features/trials` 하나뿐).
- 쿼리 키는 `features/trials/hooks/queryKeys.ts` 의 `trialKeys` 만 사용 (문자열 배열 직접 작성 금지).
- 상단 KPI 카드는 별도 API가 없다 — 목록 응답을 `features/trials/lib/aggregate.ts::computeStats` 로 프론트 집계.

## 라이브 n8n 직결 (mock 제거됨)

**mock 은 삭제됐다** (`features/trials/mock/` · `USE_MOCK` 분기 모두 없음). 모든 `/api/*` 는 실제 n8n 을 호출한다.
→ `.env.local` 이 비면 개발도 불가하고 전부 502 다. 필요한 env 는 `.env.example` 참조.

- **n8n 경로는 `@/lib/n8n` 의 `n8nPaths` 로만 만든다.** 문자열을 직접 조립하지 말 것 —
  n8n 은 경로에 동적 값(`:trial_id`)이 있으면 **노드별 `webhookId`(UUID)를 경로 앞에 강제로 붙인다.**
  그래서 엔드포인트마다 UUID env 가 따로 있고(`N8N_WEBHOOK_ID_*`), 목록만 UUID 없이 `/webhook/trials` 다.
- `N8N_API_TOKEN` 은 **선택**이다(값이 있으면 `x-api-key` 로 붙는다). n8n 쪽 Header Auth 를 켜면 필수가 된다.
- **쓰기는 프로덕션 DB(`automation.trial_dashboard_state`)에 즉시 반영된다.** 체크박스 클릭·메모 자동 저장이
  전부 실제 쓰기다 — 테스트·디버깅 시 아무 trial 이나 건드리지 말 것.
- 워크플로우가 비활성이면 n8n 이 404 `"The requested webhook ... is not registered"` 를 준다.
  이 문구가 보이면 코드 문제가 아니라 **n8n 캔버스에서 워크플로우를 활성화**해야 하는 상태다.

## Next 16 / 스택 주의점

- `AGENTS.md` 지시대로 **코드 작성 전 `node_modules/next/dist/docs/` 의 해당 가이드를 확인**한다 (학습 데이터와 API가 다를 수 있음).
- Route Handler 의 `params` 는 **Promise** → `const { id } = await params`.
- `reactCompiler: true` (next.config.ts) — 수동 `useMemo`/`useCallback` 최적화를 덧붙이지 않는다.
- 프리미티브는 **Base UI**(`@base-ui/react`), Radix 아님. shadcn style `base-nova` / baseColor `neutral`.
- `.dark` 클래스는 `app/layout.tsx` 의 `<html>` 에 하드코딩(다크 고정). next-themes 토글 UI는 없다.
- 클라 전용 라이브러리(MDXEditor)는 `dynamic(..., { ssr: false })` 로만 로드 (`InitializedMDXEditor` 래퍼 경유).

## 계약 수렴 상태

`src/**` 는 계약([docs/contract/openapi.yaml](../backend/docs/contract/openapi.yaml))에 **수렴 완료**다.
쓰기 2개는 REST 화됐다 — `trial_id` 는 **경로에만** 있고 body 에 넣지 않는다:

| 프론트 | 메서드 | body |
|---|---|---|
| `/api/trials` | GET | — |
| `/api/trials/{id}` | GET | — |
| `/api/trials/{id}/pre-trial-call-check` | PATCH | `{stage, checked}` |
| `/api/trials/{id}/note` | PATCH | `{note}` |

- **훅의 variables ≠ 요청 body.** `trial_id` 는 optimistic 갱신에 필요하므로 variables 에는 남기고,
  `mutationFn` 에서 구조분해로 떼어 경로로 보낸다. 컴포넌트 호출부는 `mutate({trial_id, ...})` 그대로다.
- **DB 값과 화면 라벨을 혼동하지 말 것.** `mentor_tier` 의 값은 `elite | normal`(라이브 distinct)이지만
  제품 용어는 elite/basic 이라 **라벨은 "Basic"** 을 유지한다 (`lib/format.ts::tierMeta`).
- 응답/요청 모양을 바꿀 땐 계약이 먼저다 → 공용 `CLAUDE.md` §경계를 넘는 변경.
  수렴 순서는 type → `lib/api.ts` → route handler → hooks → components → e2e.

# Testing

**테스트 레이어는 Playwright E2E 하나뿐이다** — 단위 테스트 러너(Vitest 등)는 미도입.
`computeStats`·`toE164` 같은 순수 함수도 현재는 E2E로 간접 검증된다. 러너를 새로 들이지 말고,
기능/수정 시 `e2e/` 에 시나리오를 추가한다. 전체 규칙·함정 표는 [docs/testing.md](../docs/testing.md).

⚠️ **현재 4개 spec 전부 `test.describe.skip` 상태다.** mock 제거로 기대값(active 11 / Remaining 3 등)이
무효해졌고, 쓰기 테스트는 이제 **프로덕션 DB에 실제로 쓴다.** 되살리려면 각 파일 헤더의 전제 3개를 먼저 해결한다.

| spec | 커버 범위 | 상태 |
|---|---|---|
| `dashboard.spec.ts` | KPI 집계, 목록/배지, 취소행, 구매 표시 | skip — 기대값 재도출 필요 |
| `precheck.spec.ts` | 체크박스 optimistic + Remaining KPI + 상태 복원 | skip — 프로덕션 쓰기 |
| `detail-sheet.spec.ts` | 상세 열기/데이터, CloudTalk 링크, 리사이즈, Esc 닫기 | skip — 고정 trial_id 의존 |
| `notes.spec.ts` | 마크다운 WYSIWYG 렌더 + `sales_note` 자동 저장/dirty 체크 | skip — 프로덕션 쓰기 |

- **셀렉터는 `e2e/helpers.ts` 를 재사용**한다 (`gotoDashboard` · `openDetail` · `row` · `kpiValue` · `SHEET`).
  직접 셀렉터를 새로 쓰기 전에 helpers 에 이미 있는지 본다.
- **상태를 바꾸는 테스트는 프로덕션 DB를 건드린다** — 원복 경로 없이 쓰기 테스트를 켜지 말 것 (§라이브 n8n 직결).
- 자주 걸리는 함정 2개: CloudTalk 앵커는 base UI 때문에 `role=link` 로 안 잡히므로
  `a[href^="ct+tel:"]` 로 찾고, 시트는 열림 애니메이션(≈350ms) 정착 후 좌표를 측정한다.
  체크박스는 `aria-checked` 기반이라 `toBeChecked()` 로 단언한다.
- 실패 시: `test-results/**/error-context.md`(ARIA 스냅샷) → `trace.zip` 순으로 본다.
- `test-results/`·`playwright-report/` 는 커밋 금지(gitignore).
