import { NextResponse } from "next/server";
import { callN8n, n8nPaths } from "@/lib/n8n";
import { setMockNote } from "@/features/trials/mock/trials.mock";
import type { NoteRequest } from "@/types/trial";

export const dynamic = "force-dynamic";

const USE_MOCK = !process.env.N8N_BASE_URL;

// PATCH /api/trials/[id]/note  ->  n8n PATCH /webhook/{hookId}/trials/<trial_id>/note
// 학생 추가정보(세일즈 메모) 저장.
// trial_id 는 경로 파라미터다(body 아님). body 는 { note } 뿐이고 n8n 에 그대로 전달한다.
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
  if (typeof note !== "string") {
    return NextResponse.json(
      { error: "Body must be { note: string }" },
      { status: 400 },
    );
  }

  if (USE_MOCK) {
    const ok = setMockNote(trial_id, note);
    if (!ok) {
      return NextResponse.json({ error: "Trial not found" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true, trial_id, note },
      { headers: { "cache-control": "no-store" } },
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
