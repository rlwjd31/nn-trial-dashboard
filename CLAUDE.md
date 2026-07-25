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
  켜둔 dev 서버가 있으면 재사용한다. **mock 상태(§Mock mode)를 초기화하려면 dev 서버를 재시작**한다.

# Architecture

## 요청 경로 (단방향)

```
components ─→ hooks (TanStack Query) ─→ @/lib/api ─→ src/app/api/**/route.ts ─→ @/lib/n8n ─→ n8n webhook ─→ Cloud SQL
             useTrials/useTrialDetail/  브라우저 fetch    서버 경계(프록시)       "server-only" +
             usePrecheckMutation        (자기 도메인만)   force-dynamic          x-api-key 부착
```

- 역방향 import 금지. 브라우저 코드는 **자기 도메인 `/api/*` 만** 호출하고 n8n URL·토큰을 모른다.
- `@/lib/n8n` 은 `import "server-only"` 가드 + `requireEnv()` 로 env 누락 시 즉시 throw.
- 폴더 배치 규칙·결정 트리는 [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) (feature-lite: 도메인은 `features/trials` 하나뿐).
- 쿼리 키는 `features/trials/hooks/queryKeys.ts` 의 `trialKeys` 만 사용 (문자열 배열 직접 작성 금지).
- 상단 KPI 카드는 별도 API가 없다 — 목록 응답을 `features/trials/lib/aggregate.ts::computeStats` 로 프론트 집계.

## Mock mode (가장 자주 걸리는 부분)

세 Route Handler 모두 `const USE_MOCK = !process.env.N8N_BASE_URL` 로 분기한다.
`N8N_BASE_URL` 이 비어 있으면 n8n 대신 `features/trials/mock/trials.mock.ts` 를 서빙한다 → **env 를 채우면 자동으로 실제 프록시로 전환.**

- mock 의 precheck 쓰기(`setMockPrecheck`)는 **dev 서버 프로세스 메모리(모듈 스코프 Map)** 에 남는다.
  → 요청 간·테스트 간 상태가 공유되므로 E2E는 `workers: 1` 직렬 실행 + 테스트 말미 원복이 필수다.
  완전 초기화는 dev 서버 재시작뿐.
- E2E 기대값은 mock 시드에 고정돼 있다(active 11 / Remaining 3 / Converted 2 등).
  **시드를 바꾸면 `e2e/*.spec.ts` 기대값도 함께 갱신**한다. 규칙·알려진 함정은 [docs/testing.md](../docs/testing.md).
- mock 파일 헤더에 각 필드 → 실제 DB 컬럼 매핑이 주석으로 있다. 필드 의미를 확인할 때 여기를 먼저 본다.

## Next 16 / 스택 주의점

- `AGENTS.md` 지시대로 **코드 작성 전 `node_modules/next/dist/docs/` 의 해당 가이드를 확인**한다 (학습 데이터와 API가 다를 수 있음).
- Route Handler 의 `params` 는 **Promise** → `const { id } = await params`.
- `reactCompiler: true` (next.config.ts) — 수동 `useMemo`/`useCallback` 최적화를 덧붙이지 않는다.
- 프리미티브는 **Base UI**(`@base-ui/react`), Radix 아님. shadcn style `base-nova` / baseColor `neutral`.
- `.dark` 클래스는 `app/layout.tsx` 의 `<html>` 에 하드코딩(다크 고정). next-themes 토글 UI는 없다.
- 클라 전용 라이브러리(MDXEditor)는 `dynamic(..., { ssr: false })` 로만 로드 (`InitializedMDXEditor` 래퍼 경유).

## 미수렴 상태 (작업 전 반드시 인지)

`src/**` 가 아직 계약(openapi.yaml)에 수렴하지 않았다. 관련 파일을 만질 때 함께 정리한다 —
해야 할 목록은 [docs/contract/api-contract.md](../docs/contract/api-contract.md) "프론트 변경 체크리스트".

| 항목 | 현재 `src/**` | 계약(openapi) |
|---|---|---|
| 체크 필드 | `precheck_1/2/3` (boolean ×3) | `pre_trial_call_checks: boolean[]` |
| 체크 엔드포인트 | `/api/trials/precheck` | `/api/trials/pre-trial-call-check` |
| 콜 메모 | `NotesEditor` → **localStorage 임시** | `PATCH /api/trials/note` (`sales_note`) |
| KPI | `pre_call_done`·`post_call_done` 타일 존재 | 백엔드에서 제거됨 → 타일 삭제 대상 |

`src/types/trial.ts` 는 위 "현재" 컬럼을 반영한 상태다. 계약 쪽으로 옮길 땐
type → `lib/api.ts` → route handler → hooks → components → mock → e2e 순으로 한 번에 맞춘다.

# Testing

**테스트 레이어는 Playwright E2E 하나뿐이다** — 단위 테스트 러너(Vitest 등)는 미도입.
`computeStats`·`toE164` 같은 순수 함수도 현재는 E2E로 간접 검증된다. 러너를 새로 들이지 말고,
기능/수정 시 `e2e/` 에 시나리오를 추가한다. 전체 규칙·함정 표는 [docs/testing.md](../docs/testing.md).

| spec | 커버 범위 |
|---|---|
| `dashboard.spec.ts` | KPI 집계, 목록/배지, 취소행, 구매 표시 |
| `precheck.spec.ts` | 체크박스 optimistic + Remaining KPI + 상태 복원 |
| `detail-sheet.spec.ts` | 상세 열기/데이터, CloudTalk 링크, 리사이즈, Esc 닫기 |
| `notes.spec.ts` | 마크다운 WYSIWYG 렌더 + localStorage 유지 |

- **셀렉터는 `e2e/helpers.ts` 를 재사용**한다 (`gotoDashboard` · `openDetail` · `row` · `kpiValue` · `SHEET`).
  직접 셀렉터를 새로 쓰기 전에 helpers 에 이미 있는지 본다.
- **상태를 바꾸는 테스트는 반드시 원복**한다 (mock precheck 은 dev 서버 메모리 공유 — §Mock mode).
- 자주 걸리는 함정 2개: CloudTalk 앵커는 base UI 때문에 `role=link` 로 안 잡히므로
  `a[href^="ct+tel:"]` 로 찾고, 시트는 열림 애니메이션(≈350ms) 정착 후 좌표를 측정한다.
  체크박스는 `aria-checked` 기반이라 `toBeChecked()` 로 단언한다.
- 실패 시: `test-results/**/error-context.md`(ARIA 스냅샷) → `trace.zip` 순으로 본다.
- `test-results/`·`playwright-report/` 는 커밋 금지(gitignore).
