import { NextResponse } from "next/server";
import { callN8n } from "@/lib/n8n";
import type { PrecheckRequest } from "@/types/trial";

export const dynamic = "force-dynamic";


// PATCH /api/trials/precheck  ->  n8n PATCH /webhook/trials/precheck
export async function PATCH(req: Request) {
  let body: PrecheckRequest;
  try {
    body = (await req.json()) as PrecheckRequest;
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

  try {
    const res = await callN8n("/webhook/trials/precheck", {
      method: "PATCH",
      body: JSON.stringify({ trial_id, stage, checked }),
    });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("[/api/trials/precheck] proxy error:", err);
    return NextResponse.json(
      { error: "Failed to save precheck" },
      { status: 502 },
    );
  }
}
