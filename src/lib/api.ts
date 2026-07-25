// 브라우저 -> 자기 도메인 Route Handler 호출용 클라이언트.
// n8n URL/토큰은 여기서 다루지 않는다 (서버 Route Handler 가 프록시).

import type {
  NoteRequest,
  NoteResponse,
  PreTrialCallCheckRequest,
  PreTrialCallCheckResponse,
  TrialDetail,
  TrialsTodayResponse,
} from "@/types/trial";

async function toJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null) ?? `Request failed with ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function fetchTrialsToday(): Promise<TrialsTodayResponse> {
  const res = await fetch("/api/trials", { cache: "no-store" });
  return toJson<TrialsTodayResponse>(res);
}

export async function fetchTrialDetail(trialId: string): Promise<TrialDetail> {
  const res = await fetch(`/api/trials/${encodeURIComponent(trialId)}`, {
    cache: "no-store",
  });
  return toJson<TrialDetail>(res);
}

// 쓰기는 trial_id 를 **경로**로 보낸다 (body 에는 넣지 않는다 — 계약 §REST 화).
export async function savePreTrialCallCheck(
  trialId: string,
  input: PreTrialCallCheckRequest,
): Promise<PreTrialCallCheckResponse> {
  const res = await fetch(
    `/api/trials/${encodeURIComponent(trialId)}/pre-trial-call-check`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return toJson<PreTrialCallCheckResponse>(res);
}

export async function saveNote(input: NoteRequest): Promise<NoteResponse> {
  const res = await fetch("/api/trials/note", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return toJson<NoteResponse>(res);
}
