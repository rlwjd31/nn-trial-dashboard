import { expect, test } from "@playwright/test";
import { gotoDashboard, openDetail, SHEET } from "./helpers";

test.describe("PTC 콜 메모 (MDXEditor WYSIWYG)", () => {
  test("'# ' 입력 시 그 자리에서 H1 로 렌더된다", async ({ page }) => {
    await gotoDashboard(page);
    await openDetail(page, "20443");

    const editor = page.locator('.ptc-notes [contenteditable="true"]');
    await editor.click();
    await page.keyboard.type("# 상담 제목");

    const h1 = page.locator(".ptc-notes h1");
    await expect(h1).toHaveText("상담 제목");

    // 헤딩이 본문보다 크게 렌더(타이포 복원 확인)
    const h1Size = await h1.evaluate((el) =>
      parseFloat(getComputedStyle(el).fontSize),
    );
    expect(h1Size).toBeGreaterThan(18);
  });

  test("목록 마크다운도 렌더된다", async ({ page }) => {
    await gotoDashboard(page);
    await openDetail(page, "22238");

    const editor = page.locator('.ptc-notes [contenteditable="true"]');
    await editor.click();
    await page.keyboard.type("- 항목 하나");
    await page.keyboard.press("Enter");
    await page.keyboard.type("항목 둘");

    await expect(page.locator(".ptc-notes li")).toHaveCount(2);
  });

  test("메모가 trial 별 localStorage 에 유지된다", async ({ page }) => {
    await gotoDashboard(page);
    await openDetail(page, "20443");

    const editor = page.locator('.ptc-notes [contenteditable="true"]');
    await editor.click();
    await page.keyboard.type("유지되는 메모 텍스트");

    // 닫고
    await page.keyboard.press("Escape");
    await expect(page.locator(SHEET)).toHaveCount(0);

    // 같은 행 다시 열면 유지
    await openDetail(page, "20443");
    await expect(page.locator(".ptc-notes")).toContainText("유지되는 메모 텍스트");
  });
});
