// ⚠️ SKIP: mock 제거(라이브 n8n 직결)로 이 스펙의 기대값이 무효해졌다.
// 재작성 전제: ① n8n 워크플로우 활성화 ② 기대값을 라이브 응답에서 재도출
// ③ 쓰기(체크·메모) 테스트는 프로덕션 DB(automation.trial_dashboard_state)에 실제로 쓰므로
//    전용 테스트 trial 을 정하거나 원복 경로를 보장할 것.
import { expect, test, type Page, type Request } from "@playwright/test";
import { gotoDashboard, openDetail, SHEET } from "./helpers";

/** 자동 저장(디바운스) 이 실제로 나가는 PATCH */
function isNotePatch(req: Request): boolean {
  return req.url().includes("/api/trials/note") && req.method() === "PATCH";
}

/**
 * mock 노트는 dev 서버 메모리에 남으므로 테스트마다 원복한다(빈 문자열 = 기록 삭제).
 * 디바운스 저장이 나간 뒤에 지워야 하므로 waitForRequest 를 먼저 await 할 것.
 */
async function resetNote(page: Page, trialId: string) {
  await page.request.patch("/api/trials/note", {
    data: { trial_id: trialId, note: "" },
  });
}

test.describe.skip("PTC 콜 메모 (MDXEditor WYSIWYG)", () => {
  test("'# ' 입력 시 그 자리에서 H1 로 렌더된다", async ({ page }) => {
    await gotoDashboard(page);
    await openDetail(page, "20443");

    const saved = page.waitForRequest(isNotePatch);
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

    await saved;
    await resetNote(page, "48213");
  });

  test("목록 마크다운도 렌더된다", async ({ page }) => {
    await gotoDashboard(page);
    await openDetail(page, "22238");

    const saved = page.waitForRequest(isNotePatch);
    const editor = page.locator('.ptc-notes [contenteditable="true"]');
    await editor.click();
    await page.keyboard.type("- 항목 하나");
    await page.keyboard.press("Enter");
    await page.keyboard.type("항목 둘");

    await expect(page.locator(".ptc-notes li")).toHaveCount(2);

    await saved;
    await resetNote(page, "48219");
  });

  test("서버에 기록된 메모(sales_note)가 에디터에 로드된다", async ({ page }) => {
    // trial 48258(student 10769) 은 mock 시드에 sales_note 가 채워져 있다 (읽기만 — 원복 불필요)
    await gotoDashboard(page);
    await openDetail(page, "10769");

    await expect(page.locator(".ptc-notes h2")).toHaveText("1차 콜 요약");
    await expect(page.locator(".ptc-notes li")).toHaveCount(2);
    await expect(page.locator(".ptc-notes strong")).toHaveText("높음");
  });

  test("되돌린 편집은 저장 요청을 보내지 않는다 (dirty 체크)", async ({ page }) => {
    const patches: string[] = [];
    page.on("request", (req) => {
      if (isNotePatch(req)) patches.push(req.url());
    });

    await gotoDashboard(page);
    await openDetail(page, "10769"); // sales_note 시드 있음

    const editor = page.locator('.ptc-notes [contenteditable="true"]');
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.type("가");
    await page.keyboard.press("Backspace"); // 디바운스 안에 원래 내용으로 복귀

    // 디바운스가 지나도 요청이 없어야 한다.
    // (비교 기준은 에디터가 정규화한 초기 본문 — 원본 문자열로 비교하면 여기서 새어 나간다)
    await page.waitForTimeout(4000);
    expect(patches).toHaveLength(0);
  });

  test("메모가 서버(sales_note)에 자동 저장되고 새로고침 후에도 남는다", async ({
    page,
  }) => {
    await gotoDashboard(page);
    await openDetail(page, "20443");

    const saved = page.waitForRequest(isNotePatch);
    const editor = page.locator('.ptc-notes [contenteditable="true"]');
    await editor.click();
    await page.keyboard.type("유지되는 메모 텍스트");

    // 디바운스 저장이 PATCH /api/trials/note 로 나간다
    expect((await saved).postDataJSON()).toMatchObject({ trial_id: "48213" });

    // 닫고
    await page.keyboard.press("Escape");
    await expect(page.locator(SHEET)).toHaveCount(0);

    // 새로고침(= react-query 캐시 소멸) 후에도 서버에서 받아온다
    await page.reload();
    await expect(page.locator("table tbody tr").first()).toBeVisible();
    await openDetail(page, "20443");
    await expect(page.locator(".ptc-notes")).toContainText(
      "유지되는 메모 텍스트",
    );

    await resetNote(page, "48213");
  });
});
