import { expect, type Locator, type Page } from "@playwright/test";

export const SHEET = '[data-slot="sheet-content"]';

/** 대시보드 로드 + 목록 렌더 대기 */
export async function gotoDashboard(page: Page) {
  await page.goto("/");
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}

/** KPI 카드의 수치(<p> 두 번째) — 라벨로 찾는다 */
export function kpiValue(page: Page, label: string): Locator {
  return page
    .getByText(label, { exact: true })
    .locator("..")
    .locator("p")
    .nth(1);
}

/** student_id 로 목록 행을 찾는다 */
export function row(page: Page, studentId: string): Locator {
  return page.locator("tbody tr", { hasText: `#${studentId}` });
}

/** 행 클릭 → 상세 시트 열기 (체크박스 셀이 아닌 Time 셀 클릭) */
export async function openDetail(page: Page, studentId: string) {
  await row(page, studentId).locator("td").first().click();
  await expect(page.locator(SHEET)).toBeVisible();
  await expect(page.locator(SHEET)).toContainText("Trial 상세");
  // 상세 데이터 로드 완료 대기 (로드되면 ct+tel 발신 앵커가 나타남)
  // base-ui Button 이 <a> 를 role=button 으로 렌더하므로 href 기반으로 찾는다.
  await expect(page.locator('a[href^="ct+tel:"]')).toBeVisible();
}
