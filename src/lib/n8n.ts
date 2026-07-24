import "server-only";

// 서버 전용 n8n 프록시 유틸.
// N8N_BASE_URL / N8N_API_TOKEN 은 NEXT_PUBLIC_ 접두어 없이 서버에서만 접근.
// 브라우저 번들에 절대 포함되지 않도록 "server-only" 로 가드한다.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

/**
 * n8n Webhook 으로 프록시 요청을 보낸다.
 * - x-api-key 헤더 자동 부착
 * - path 는 "/webhook/..." 형태의 n8n 경로
 */
export async function callN8n(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const baseUrl = requireEnv("N8N_BASE_URL").replace(/\/+$/, "");
  const token = requireEnv("N8N_API_TOKEN");
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  return fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-api-key": token,
      ...(init?.headers ?? {}),
    },
    // 목록/상세/쓰기 모두 서버 캐시 미사용 (PRD 섹션 5).
    cache: "no-store",
  });
}
