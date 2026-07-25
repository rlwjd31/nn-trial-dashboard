import { NextResponse } from "next/server";
import { callN8n } from "@/lib/n8n";

export const dynamic = "force-dynamic";


// GET /api/trials/[id]  ->  n8n GET /webhook/trials/detail?trial_id=<id>
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing trial id" }, { status: 400 });
  }

  try {
    const res = await callN8n(
      `/webhook/trials/detail?trial_id=${encodeURIComponent(id)}`,
      { method: "GET" },
    );
    const body = await res.json();
    return NextResponse.json(body, {
      status: res.status,
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    console.error(`[/api/trials/${id}] proxy error:`, err);
    return NextResponse.json(
      { error: "Failed to fetch trial detail" },
      { status: 502 },
    );
  }
}
