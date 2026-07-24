import { NextResponse } from "next/server";
import { callN8n } from "@/lib/n8n";
import { getMockTrialsToday } from "@/features/trials/mock/trials.mock";

// 목록 GET 은 캐시하지 않음 (PRD 섹션 5).
export const dynamic = "force-dynamic";

// N8N_BASE_URL 미설정 시 mock 서빙. env 채우면 자동으로 n8n 프록시.
const USE_MOCK = !process.env.N8N_BASE_URL;

// GET /api/trials  ->  n8n GET /webhook/trials/today
export async function GET() {
  if (USE_MOCK) {
    return NextResponse.json(getMockTrialsToday(), {
      headers: { "cache-control": "no-store" },
    });
  }

  try {
    const res = await callN8n("/webhook/trials/today", { method: "GET" });
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
