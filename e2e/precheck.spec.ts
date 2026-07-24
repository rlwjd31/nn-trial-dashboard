import { expect, test } from "@playwright/test";
import { gotoDashboard, kpiValue, row } from "./helpers";

test.describe("pre-trial 체크박스 (optimistic)", () => {
  test("0-체크 trial 체크 시 즉시 반영 + Remaining KPI 감소, 다시 해제하면 복원", async ({
    page,
  }) => {
    await gotoDashboard(page);
    await expect(kpiValue(page, "Remaining")).toHaveText("3");

    const r = row(page, "10671"); // hayoon 15:30 — 체크 0개, scheduled
    const cb1 = r.getByRole("checkbox", { name: "Pre-trial 1" });
    await expect(cb1).not.toBeChecked();

    // 체크 → optimistic 즉시 반영 + KPI 재계산(재조회 없음)
    await cb1.click();
    await expect(cb1).toBeChecked();
    await expect(kpiValue(page, "Remaining")).toHaveText("2");

    // 복원 (서버 mock 상태 원복)
    await cb1.click();
    await expect(cb1).not.toBeChecked();
    await expect(kpiValue(page, "Remaining")).toHaveText("3");
  });

  test("이미 일부 체크된 trial 은 Remaining 에서 제외되어 있다", async ({
    page,
  }) => {
    await gotoDashboard(page);
    const r = row(page, "10644"); // minjun — precheck_1=true (Remaining 아님)
    const cb1 = r.getByRole("checkbox", { name: "Pre-trial 1" });
    await expect(cb1).toBeChecked();
  });
});
