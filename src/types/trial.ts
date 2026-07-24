// PRD 섹션 7 n8n API 계약 기준 타입 정의.
// 섹션 9(데이터 계약)가 미확정이므로, DB 스키마 확정 후 조정될 수 있음.

export type MentorTier = "elite" | "basic";

/** GET /webhook/trials/today 의 trials[] 원소 (= /api/trials) */
export interface TrialListItem {
  trial_id: string;
  /** ISO8601, KST 오프셋 포함. 예: "2026-07-24T14:00:00+09:00" */
  trial_time: string;
  student_id: string;
  student_email: string;
  student_phone_number: string;
  mentor_name: string;
  mentor_tier: MentorTier;
  status: string;
  precheck_1: boolean;
  precheck_2: boolean;
  precheck_3: boolean;
  pre_call_done: boolean;
  post_call_done: boolean;
  converted: boolean;
}

export interface TrialsTodayResponse {
  trials: TrialListItem[];
}

/** GET /webhook/trials/detail?trial_id=<id> (= /api/trials/[id]) */
export interface TrialDetail {
  trial_id: string;
  student_id: string;
  student_email: string;
  student_phone_number: string;
  level: string;
  mentor_id: string;
  mentor_name: string;
  mentor_gender: string;
  interests: string[];
  /** ISO8601 date. 예: "2026-07-24" */
  trial_date: string;
  call_queue_url: string;
}

/** precheck 저장 단계 */
export type PrecheckStage = 1 | 2 | 3;

/** PATCH /webhook/trials/precheck body (= /api/trials/precheck) */
export interface PrecheckRequest {
  trial_id: string;
  stage: PrecheckStage;
  checked: boolean;
}

export interface PrecheckResponse {
  ok: true;
  trial_id: string;
  stage: PrecheckStage;
  checked: boolean;
}

/** n8n / Route Handler 공통 에러 응답 */
export interface ApiError {
  error: string;
}
