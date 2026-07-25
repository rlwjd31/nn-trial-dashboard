import { NextResponse } from "next/server";
import { callN8n } from "@/lib/n8n";
import type { NoteRequest } from "@/types/trial";

export const dynamic = "force-dynamic";


// PATCH /api/trials/note  ->  n8n PATCH /webhook/trials/note
// 저장처: automation.trial_dashboard_state.sales_note (계약 openapi.yaml §/trials/note)
export async function PATCH(req: Request) {
  let body: NoteRequest;
  try {
    body = (await req.json()) as NoteRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { trial_id, note } = body ?? {};
  // 빈 문자열은 "기록 삭제" 로 허용되는 값이므로 falsy 검사 대신 타입만 본다.
  if (!trial_id || typeof note !== "string") {
    return NextResponse.json(
      { error: "Body must be { trial_id: string, note: string }" },
      { status: 400 },
    );
  }

  try {
    const res = await callN8n("/webhook/trials/note", {
      method: "PATCH",
      body: JSON.stringify({ trial_id, note }),
    });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("[/api/trials/note] proxy error:", err);
    return NextResponse.json({ error: "Failed to save note" }, { status: 502 });
  }
}
