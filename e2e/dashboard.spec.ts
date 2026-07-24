import { expect, test } from "@playwright/test";
import { gotoDashboard, kpiValue, row } from "./helpers";

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await gotoDashboard(page);
  });

  test("KPI 카드가 목록 집계를 표시한다", async ({ page }) => {
    await expect(kpiValue(page, "Today's trials")).toHaveText("11");
    await expect(kpiValue(page, "Remaining")).toHaveText("3");
    await expect(kpiValue(page, "Pre-call done")).toHaveText("6");
    await expect(kpiValue(page, "Post-call done")).toHaveText("2");
    await expect(kpiValue(page, "Converted today")).toHaveText("2");
  });

  test("모든 trial 행과 배지가 렌더된다", async ({ page }) => {
    await expect(page.locator("tbody tr")).toHaveCount(12);

    const r = row(page, "10432");
    await expect(r).toContainText("09:00");
    await expect(r).toContainText("jiwoo.parent@gmail.com");
    await expect(r).toContainText("Emma Wilson");
    await expect(r).toContainText("Elite");
    await expect(r).toContainText("Completed");
    await expect(r).toContainText("Andrew");
    await expect(r.getByText("Purchased")).toBeVisible();
  });

  test("취소된 trial 은 Canceled 배지 + 체크박스 비활성", async ({ page }) => {
    const r = row(page, "10702"); // chaewon, canceled
    await expect(r).toContainText("Canceled");
    const checkboxes = r.getByRole("checkbox");
    await expect(checkboxes).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(checkboxes.nth(i)).toBeDisabled();
    }
  });

  test("구매하지 않은 trial 은 Purchased 대신 '—'", async ({ page }) => {
    const r = row(page, "10588"); // dohyun, converted=false
    await expect(r.getByText("Purchased")).toHaveCount(0);
    await expect(r).toContainText("—");
  });
});
