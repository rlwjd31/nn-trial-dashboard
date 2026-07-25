import { NextResponse } from "next/server";
import { callN8n, n8nPaths } from "@/lib/n8n";
import { setMockPreTrialCallCheck } from "@/features/trials/mock/trials.mock";
import type { PreTrialCallCheckRequest } from "@/types/trial";

export const dynamic = "force-dynamic";

const USE_MOCK = !process.env.N8N_BASE_URL;

// PATCH /api/trials/[id]/pre-trial-call-check
//   -> n8n PATCH /webhook/{hookId}/trials/<trial_id>/pre-trial-call-check
// trial_id 는 경로 파라미터다(body 아님). body 는 { stage, checked } 뿐이고 n8n 에 그대로 전달한다.
// 저장처: automation.trial_dashboard_state.pre_trial_call_checks[stage]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: trial_id } = await params;
  if (!trial_id) {
    return NextResponse.json({ error: "Missing trial id" }, { status: 400 });
  }

  let body: PreTrialCallCheckRequest;
  try {
    body = (await req.json()) as PreTrialCallCheckRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { stage, checked } = body ?? {};
  if (![1, 2, 3].includes(stage) || typeof checked !== "boolean") {
    return NextResponse.json(
      { error: "Body must be { stage: 1|2|3, checked: boolean }" },
      { status: 400 },
    );
  }

  if (USE_MOCK) {
    const ok = setMockPreTrialCallCheck(trial_id, stage, checked);
    if (!ok) {
      return NextResponse.json({ error: "Trial not found" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true, trial_id, stage, checked },
      { headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const res = await callN8n(n8nPaths.preTrialCallCheck(trial_id), {
      method: "PATCH",
      body: JSON.stringify({ stage, checked }),
    });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    console.error(
      `[/api/trials/${trial_id}/pre-trial-call-check] proxy error:`,
      err,
    );
    return NextResponse.json(
      { error: "Failed to save pre-trial call check" },
      { status: 502 },
    );
  }
}
