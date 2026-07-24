# E2E 테스트 가이드 (Playwright)

프론트 동작을 **실제 브라우저에서** 검증하는 End-to-End 테스트 규칙. 새 기능/수정 시
이 문서의 규칙을 따라 `e2e/` 에 테스트를 추가한다.

> 범위: 사용자 관점의 UI 동작(렌더·상호작용·상태). 단위 테스트는 별도(현재 없음).
> 데이터는 mock(`src/features/trials/mock/trials.mock.ts`)을 기준으로 검증한다.

## 1. 스택 & 실행

- **Playwright** (`@playwright/test`), 브라우저 chromium.
- 실행: `pnpm test:e2e` (= `playwright test`).
- 설정: [`playwright.config.ts`](../playwright.config.ts)
  - `testDir: ./e2e`, `baseURL: http://localhost:3000`
  - `workers: 1`, `fullyParallel: false` — **직렬 실행**(이유 §3)
  - `webServer`: `pnpm dev` 를 자동 기동하되 `reuseExistingServer: true`
    → 이미 켜둔 dev 서버가 있으면 재사용, 없으면 새로 띄운다.
  - `trace: retain-on-failure` — 실패 시 `test-results/**/trace.zip` 보존
    (`pnpm exec playwright show-trace <경로>` 로 확인).

첫 실행 시 브라우저가 없으면: `pnpm exec playwright install chromium`
(`@playwright/test` 버전과 브라우저 빌드 번호가 맞아야 함 — 버전 업 시 재설치).

## 2. 디렉토리 구조

```
e2e/
├─ helpers.ts          # 공용 셀렉터/액션 (gotoDashboard, openDetail, kpiValue, row, SHEET)
├─ dashboard.spec.ts   # KPI 집계, 목록/배지, 취소행, 구매 표시
├─ precheck.spec.ts    # 체크박스 optimistic + Remaining KPI + 복원
├─ detail-sheet.spec.ts# 상세 열기/데이터, CloudTalk 링크, 리사이즈, Esc 닫기
└─ notes.spec.ts       # 마크다운 WYSIWYG 렌더 + localStorage 유지
```

`test-results/`, `playwright-report/` 는 `.gitignore` 처리(커밋 금지).

## 3. 설계 규칙 (반드시 지킬 것)

1. **직렬 실행 + 상태 복원.** mock의 precheck 저장은 dev 서버 **메모리(Map)** 에
   남아 테스트 간 공유된다(`setMockPrecheck`). 그래서 `workers: 1` 로 돌리고,
   상태를 바꾸는 테스트는 **끝에서 원복**한다(예: 체크 후 다시 해제).
   완전 초기화가 필요하면 dev 서버를 재시작한다(Map 초기화).
2. **결정론적 기대값.** mock 시드 기준 고정값으로 단언한다
   (오늘 active=11, Remaining=3, Pre-call=6, Post-call=2, Converted=2).
   시드를 바꾸면 이 값들도 함께 갱신한다.
3. **셀렉터 전략.** 우선순위: 역할/텍스트 → 안정적 속성. 함정 있는 곳은 §4 참고.
   - 상세 시트: `[data-slot="sheet-content"]` (helpers `SHEET`).
   - 목록 행: `tbody tr` + `hasText: "#<studentId>"` (helpers `row`).
   - KPI 값: 라벨 텍스트로 카드를 찾고 두 번째 `<p>` (helpers `kpiValue`).
4. **자동 대기 사용.** `expect(...).toBeVisible()`, `toHaveText`, `expect.poll` 등
   Playwright 자동 재시도를 쓰고, 임의 `waitForTimeout` 은 애니메이션 정착 등
   불가피한 경우로 최소화한다.

## 4. 알려진 함정 & 해결 (디버깅으로 확인된 것)

| 증상 | 원인 | 해결 |
|---|---|---|
| CloudTalk 버튼을 `getByRole('link')` 로 못 찾음 | base-ui `Button` 을 `<a>` 로 렌더해도 **role 을 `button` 으로 유지** (발신은 정상) | `page.locator('a[href^="ct+tel:"]')` 로 href 기준 선택 |
| 드래그 리사이즈가 반영 안 됨 | 시트 **열림 슬라이드 애니메이션(duration-200)** 중 좌표가 어긋남 | 측정/드래그 전 정착 대기(`waitForTimeout(350)`) + 결과는 `expect.poll` |
| 상세 의존 단언이 간헐 실패 | 상세는 비동기 로드(로딩 중 CloudTalk는 "번호 없음" 버튼) | `openDetail` 이 `a[href^="ct+tel:"]` 가시화까지 대기 |
| CloudTalk `?from=` 누락 | `NEXT_PUBLIC_CLOUDTALK_FROM` 미로딩 | `.env.local` 에 값 + dev 서버 재시작(빌드시 인라인) |
| 메모 에디터가 안 뜸 | MDXEditor 는 `dynamic(ssr:false)` 로 상세 열 때 로드 | 상세 로드 후 `.ptc-notes [contenteditable="true"]` 대기 |

체크박스 상태는 base-ui가 `aria-checked` 를 세팅하므로 `toBeChecked()` /
`not.toBeChecked()` 로 검증한다.

## 5. 새 테스트 추가하기

1. `e2e/<feature>.spec.ts` 생성, `helpers.ts` 의 공용 액션 재사용.
2. 상태를 변경하면 `afterEach`/테스트 말미에 **원복**.
3. `pnpm test:e2e` 로 확인. 실패 시 `test-results/.../error-context.md`(ARIA 스냅샷)와
   trace 로 원인 파악.

## 6. 시각 검증 (스크린샷)

픽셀/레이아웃 확인이 필요하면 스크린샷을 남긴다:
```ts
await page.screenshot({ path: "shot.png" });
```
디자인 회귀가 잦아지면 `toHaveScreenshot()`(시각 회귀 스냅샷) 도입을 검토한다.

## 7. 향후 (미도입)

- CI 연동(GitHub Actions 등)에서 `webServer` 로 자동 기동해 실행.
- 실제 n8n 연동 후: mock 대신 스텁 서버/픽스처로 계약 테스트.
- 단위 테스트(집계 `computeStats`, `toE164` 등 순수 함수)는 Vitest 등으로 분리 검토.
