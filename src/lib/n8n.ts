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
 * n8n Webhook 노드는 경로에 동적 값(`:trial_id`)이 있으면 **노드별 `webhookId` 를 경로 앞에 강제로
 * 붙인다** (노드 문서: "If dynamic values are set 'webhookId' would be prepended to path").
 * 반대로 동적 값이 없는 경로는 UUID 없이 그대로 서빙된다 → 목록만 예외다.
 *
 *   GET  /webhook/trials                                   ← 동적 값 없음, UUID 없음
 *   GET  /webhook/<uuid>/trials/<trial_id>                  ← UUID 필요
 *   PATCH /webhook/<uuid>/trials/<trial_id>/pre-trial-call-check
 *   PATCH /webhook/<uuid>/trials/<trial_id>/note
 *
 * 그래서 base URL 하나로 묶을 수 없고, UUID 3개를 env 로 주입한다.
 * UUID 는 n8n 워크플로우 "[Trial API] - Main" 각 Webhook 노드의 Production URL 에서 읽는다.
 */
export const n8nPaths = {
  /**
   * GET 목록 — n8n `GET /webhook/trials`.
   * 이 경로만 동적 값이 없어서 **webhookId 가 붙지 않는다** (n8n UI 실측 확인).
   */
  trials: () => "/webhook/trials",

  /** GET 상세 — n8n `GET /webhook/{id}/trials/{trial_id}` */
  trialDetail: (trialId: string) =>
    `/webhook/${requireEnv("N8N_WEBHOOK_ID_TRIAL_DETAIL")}/trials/${encodeURIComponent(trialId)}`,

  /** PATCH pre-trial call check — n8n `PATCH /webhook/{id}/trials/{trial_id}/pre-trial-call-check` */
  preTrialCallCheck: (trialId: string) =>
    `/webhook/${requireEnv("N8N_WEBHOOK_ID_PRE_TRIAL_CALL_CHECK")}/trials/${encodeURIComponent(trialId)}/pre-trial-call-check`,

  /** PATCH 세일즈 메모 — n8n `PATCH /webhook/{id}/trials/{trial_id}/note` */
  note: (trialId: string) =>
    `/webhook/${requireEnv("N8N_WEBHOOK_ID_NOTE")}/trials/${encodeURIComponent(trialId)}/note`,
};

/**
 * n8n Webhook 으로 프록시 요청을 보낸다.
 * - x-api-key 헤더 자동 부착
 * - path 는 "/webhook/..." 형태의 n8n 경로 (`n8nPaths` 로 만든다)
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
