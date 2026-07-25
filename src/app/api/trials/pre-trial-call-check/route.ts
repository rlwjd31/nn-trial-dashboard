import { NextResponse } from "next/server";
import { callN8n } from "@/lib/n8n";
import { setMockPreTrialCallCheck } from "@/features/trials/mock/trials.mock";
import type { PreTrialCallCheckRequest } from "@/types/trial";

export const dynamic = "force-dynamic";

const USE_MOCK = !process.env.N8N_BASE_URL;

// PATCH /api/trials/pre-trial-call-check
//   -> n8n PATCH /webhook/trials/pre-trial-call-check
// 저장처: automation.trial_dashboard_state.pre_trial_call_checks[stage]
export async function PATCH(req: Request) {
  let body: PreTrialCallCheckRequest;
  try {
    body = (await req.json()) as PreTrialCallCheckRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { trial_id, stage, checked } = body ?? {};
  if (!trial_id || ![1, 2, 3].includes(stage) || typeof checked !== "boolean") {
    return NextResponse.json(
      { error: "Body must be { trial_id: string, stage: 1|2|3, checked: boolean }" },
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
    const res = await callN8n("/webhook/trials/pre-trial-call-check", {
      method: "PATCH",
      body: JSON.stringify({ trial_id, stage, checked }),
    });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("[/api/trials/pre-trial-call-check] proxy error:", err);
    return NextResponse.json(
      { error: "Failed to save pre-trial call check" },
      { status: 502 },
    );
  }
}
