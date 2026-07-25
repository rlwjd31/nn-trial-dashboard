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
 * n8n 웹훅 경로 빌더.
 *
 * n8n Webhook 노드는 경로에 동적 값(`:trial_id`)이 있으면 **노드별 `webhookId`(UUID)를 경로 앞에
 * 강제로 붙인다.** 반대로 동적 값이 없는 경로는 UUID 없이 그대로 서빙된다 → 목록만 예외다.
 * 그래서 엔드포인트마다 UUID env(`N8N_WEBHOOK_ID_*`)를 따로 주입받는다.
 * (계약: ../backend/docs/contract/api-contract.md — 배경: ../docs/learning/007-platform-owns-the-url.md)
 */
export const n8nPaths = {
  /** GET 목록 — 동적 값이 없어 webhookId 가 붙지 않는다 */
  trials: () => "/webhook/trials",

  /** GET 상세 */
  trialDetail: (trialId: string) =>
    `/webhook/${requireEnv("N8N_WEBHOOK_ID_TRIAL_DETAIL")}/trials/${encodeURIComponent(trialId)}`,
};

/**
 * n8n Webhook 으로 프록시 요청을 보낸다.
 * - x-api-key 헤더는 N8N_API_TOKEN 이 있을 때만 부착
 * - path 는 "/webhook/..." 형태의 n8n 경로 (`n8nPaths` 로 만든다)
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
