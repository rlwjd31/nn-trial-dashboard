import { NextResponse } from "next/server";
import { callN8n, n8nPaths } from "@/lib/n8n";
import type { NoteRequest } from "@/types/trial";

export const dynamic = "force-dynamic";

// PATCH /api/trials/[id]/note  ->  n8n PATCH /webhook/{hookId}/trials/<trial_id>/note
// trial_id 는 경로 파라미터다(body 아님). body 는 { note } 뿐이다.
// 저장처: automation.trial_dashboard_state.sales_note
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: trial_id } = await params;
  if (!trial_id) {
    return NextResponse.json({ error: "Missing trial id" }, { status: 400 });
  }

  let body: NoteRequest;
  try {
    body = (await req.json()) as NoteRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { note } = body ?? {};
  // 빈 문자열은 "기록 삭제" 로 허용되는 값이므로 falsy 검사 대신 타입만 본다.
  if (typeof note !== "string") {
    return NextResponse.json(
      { error: "Body must be { note: string }" },
      { status: 400 },
    );
  }

  try {
    const res = await callN8n(n8nPaths.note(trial_id), {
      method: "PATCH",
      body: JSON.stringify({ note }),
    });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    console.error(`[/api/trials/${trial_id}/note] proxy error:`, err);
    return NextResponse.json({ error: "Failed to save note" }, { status: 502 });
  }
}
