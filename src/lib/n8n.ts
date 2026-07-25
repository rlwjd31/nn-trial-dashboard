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
 * - x-api-key 헤더는 N8N_API_TOKEN 이 있을 때만 부착
 * - path 는 "/webhook/..." 형태의 n8n 경로
 */
export async function callN8n(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const baseUrl = requireEnv("N8N_BASE_URL").replace(/\/+$/, "");
  // Webhook 노드에 인증을 걸지 않은 상태에서도 호출돼야 하므로 토큰은 선택 사항이다.
  // 값이 있으면 x-api-key 로 붙인다(n8n 쪽에 Header Auth 를 켜면 필수가 된다).
  const token = process.env.N8N_API_TOKEN;
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  return fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-api-key": token } : {}),
      ...(init?.headers ?? {}),
    },
    // 목록/상세/쓰기 모두 서버 캐시 미사용 (PRD 섹션 5).
    cache: "no-store",
  });
}
