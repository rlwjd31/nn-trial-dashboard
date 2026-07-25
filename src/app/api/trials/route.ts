import { NextResponse } from "next/server";
import { callN8n, n8nPaths } from "@/lib/n8n";

// 목록 GET 은 캐시하지 않음 (PRD 섹션 5).
export const dynamic = "force-dynamic";


// GET /api/trials  ->  n8n GET /webhook/trials
export async function GET() {
  try {
    const res = await callN8n(n8nPaths.trials(), { method: "GET" });
    const body = await res.json();
    return NextResponse.json(body, {
      status: res.status,
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("[/api/trials] proxy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch today's trials" },
      { status: 502 },
    );
  }
}
