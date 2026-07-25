import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ⚠️ 임시 진단용. 502 원인(env 누락 vs 값 오염)을 배포본에서 확인하려고 추가했다.
// **값은 절대 노출하지 않는다** — 존재 여부·길이·공백 포함 여부만 돌려준다.
// 원인 확인 후 이 파일을 삭제할 것.
const KEYS = [
  "N8N_BASE_URL",
  "N8N_WEBHOOK_ID_TRIAL_DETAIL",
  "N8N_WEBHOOK_ID_PRE_TRIAL_CALL_CHECK",
  "N8N_WEBHOOK_ID_NOTE",
  "N8N_API_TOKEN",
  "NEXT_PUBLIC_CLOUDTALK_FROM",
] as const;

export async function GET() {
  const report = Object.fromEntries(
    KEYS.map((key) => {
      const raw = process.env[key];
      if (raw === undefined) return [key, { set: false }];
      const trimmed = raw.trim();
      return [
        key,
        {
          set: true,
          length: raw.length,
          trimmedLength: trimmed.length,
          // 붙여넣기 사고 탐지: 앞뒤 공백/줄바꿈이 있으면 length 와 trimmedLength 가 다르다
          hasSurroundingWhitespace: raw.length !== trimmed.length,
          hasInnerWhitespace: /\s/.test(trimmed),
          // 값 대신 형태만: URL 스킴 / UUID 모양인지
          looksLikeHttpsUrl: /^https:\/\/[^\s]+$/.test(trimmed),
          looksLikeUuid:
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              trimmed,
            ),
        },
      ];
    }),
  );

  // 실제로 URL 을 만들어봤을 때 유효한가 (값은 노출하지 않고 결과만)
  let baseUrlParsable: boolean | string = false;
  try {
    new URL(`${(process.env.N8N_BASE_URL ?? "").trim()}/webhook/trials`);
    baseUrlParsable = true;
  } catch (err) {
    baseUrlParsable = err instanceof Error ? err.message : "unknown error";
  }

  return NextResponse.json(
    { env: report, baseUrlParsable, region: process.env.VERCEL_REGION ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}
