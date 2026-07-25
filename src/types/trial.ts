// 계약(../backend/docs/contract/openapi.yaml) 기준 타입 정의.
// enum 값은 2026-07-25 라이브 DB distinct 실측으로 확정됐다 — 임의로 넓히지 말 것.

/** Mentors.tier — 라이브 distinct 값. (이전 스펙의 `basic` 은 존재하지 않는 값이었다) */
export type MentorTier = "elite" | "normal";

/** Mentors.gender */
export type MentorGender = "female" | "male" | "nonbinary";

/**
 * Lessons.status 중 isTrial=TRUE 인 행의 distinct 값.
 * `LessonStatusType` enum 전체에는 scheduled/in_progress 도 있지만 trial 행에서는 관측되지 않는다.
 */
export type TrialStatus = "approved" | "canceled" | "completed" | "paid";

/** GET /webhook/trials 의 trials[] 원소 (= /api/trials) */
export interface TrialListItem {
  trial_id: string;
  /** ISO8601, KST 오프셋 포함. 예: "2026-07-25T18:00:00+09:00" */
  trial_time: string;
  student_id: string;
  /** 표시용 학생 이름 (firstName+lastName, 없으면 koreanEquivalent) */
  student_name: string;
  student_email: string;
  student_phone_number: string;
  mentor_name: string;
  mentor_tier: MentorTier;
  /** 이 trial을 담당하는 Sales rep 표시명 (CallQueues 담당 admin) */
  sales_rep_name: string;
  status: TrialStatus;
  /** [1차, 2차, 3차] pre-trial call 진행 여부. 항상 길이 3 */
  pre_trial_call_checks: boolean[];
  /** CallQueues.lifecycle='converted' OR purchasedAt IS NOT NULL */
  converted: boolean;
}

export interface TrialsTodayResponse {
  trials: TrialListItem[];
}

/** GET /webhook/{hookId}/trials/{id} (= /api/trials/[id]) */
export interface TrialDetail {
  trial_id: string;
  student_id: string;
  /** 표시용 학생 이름 (firstName+lastName, 없으면 koreanEquivalent) */
  student_name: string;
  student_email: string;
  student_phone_number: string;
  /** Students.level(+langLevel) 조합. 예: "3 · Beginner-High" */
  level: string;
  mentor_id: string;
  mentor_name: string;
  mentor_gender: MentorGender;
  /** CallQueues.answersJson.interests */
  interests: string[];
  /** ISO8601 date (KST 기준). 예: "2026-07-25" */
  trial_date: string;
  /** 학생 추가정보(세일즈 메모) 마크다운 원문. 미기록이면 null */
  sales_note: string | null;
}

/** pre-trial call 저장 단계 */
export type PreTrialCallStage = 1 | 2 | 3;

/**
 * PATCH /api/trials/{id}/pre-trial-call-check 의 요청 body.
 * trial_id 는 **경로에만** 있다 (body 에 넣지 않는다).
 */
export interface PreTrialCallCheckRequest {
  stage: PreTrialCallStage;
  checked: boolean;
}

/** 응답에는 trial_id 가 에코로 돌아온다 */
export interface PreTrialCallCheckResponse {
  ok: true;
  trial_id: string;
  stage: PreTrialCallStage;
  checked: boolean;
}

/** PATCH /api/trials/{id}/note 의 요청 body (trial_id 는 경로) */
export interface NoteRequest {
  /** 마크다운 원문. 빈 문자열이면 기록 삭제로 취급된다 */
  note: string;
}

export interface NoteResponse {
  ok: true;
  trial_id: string;
  note: string;
}

/** n8n / Route Handler 공통 에러 응답 */
export interface ApiError {
  error: string;
}
