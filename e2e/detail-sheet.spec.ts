// ⚠️ SKIP: mock 제거(라이브 n8n 직결)로 이 스펙의 기대값이 무효해졌다.
// 재작성 전제: ① n8n 워크플로우 활성화 ② 기대값을 라이브 응답에서 재도출
// ③ 쓰기(체크·메모) 테스트는 프로덕션 DB(automation.trial_dashboard_state)에 실제로 쓰므로
//    전용 테스트 trial 을 정하거나 원복 경로를 보장할 것.
import { expect, test } from "@playwright/test";
import { gotoDashboard, openDetail, SHEET } from "./helpers";

test.describe.skip("상세 시트", () => {
  test("행 클릭 시 학생 상세가 열린다", async ({ page }) => {
    await gotoDashboard(page);
    await openDetail(page, "20443");
    const sheet = page.locator(SHEET);
    await expect(sheet).toContainText("Hyeong Chang Lim");
    await expect(sheet).toContainText("hyeonchang2002@gmail.com");
    await expect(sheet).toContainText("Emma Wilson");
    await expect(sheet).toContainText("Minecraft");
    await expect(sheet).toContainText("2026-07-25");
  });

  test("CloudTalk 버튼이 E.164 ct+tel 링크를 만든다", async ({ page }) => {
    await gotoDashboard(page);
    await openDetail(page, "20443"); // 01051835277 (국내 표기)
    const call = page.locator('a[href^="ct+tel:"]');
    await expect(call).toHaveAttribute(
      "href",
      "ct+tel:%2B821051835277?from=%2B82234986970",
    );
  });

  test("admin panel · call-queue 링크가 student_id 로 생성된다", async ({
    page,
  }) => {
    await gotoDashboard(page);
    await openDetail(page, "20443");
    const sheet = page.locator(SHEET);
    await expect(
      sheet.locator('a[href="https://admin.naonow.com/students/20443/edit"]'),
    ).toBeVisible();
    await expect(
      sheet.locator('a[href="https://admin.naonow.com/call-queue/20443"]'),
    ).toBeVisible();
  });

  test("시트 폭을 드래그로 넓힐 수 있다", async ({ page }) => {
    await gotoDashboard(page);
    await openDetail(page, "20443");
    const sheet = page.locator(SHEET);
    await page.waitForTimeout(350); // 열림 슬라이드 애니메이션 정착 대기
    const before = (await sheet.boundingBox())!.width;

    const handle = sheet.locator(".cursor-col-resize");
    const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + 3, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x - 220, hb.y + hb.height / 2, { steps: 12 });
    await page.mouse.up();

    // 상태 반영(re-render)까지 폴링
    await expect
      .poll(async () => (await sheet.boundingBox())!.width)
      .toBeGreaterThan(before + 120);
  });

  test("Esc 로 시트를 닫는다", async ({ page }) => {
    await gotoDashboard(page);
    await openDetail(page, "20443");
    await page.keyboard.press("Escape");
    await expect(page.locator(SHEET)).toHaveCount(0);
  });
});
