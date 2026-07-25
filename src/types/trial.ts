// API 계약 타입 — SoT 는 docs/contract/openapi.yaml 이다.
// 이 파일은 그 스펙의 TypeScript 표현이며, 스펙을 고친 뒤 여기를 맞춘다(역방향 아님).
// 검증: `pnpm test:contract` 가 실제 응답을 openapi.yaml 과 대조한다.

/** Mentors.tier — 라이브 DB distinct 값 (2026-07-25): elite, normal. (`basic` 은 존재하지 않음) */
export type MentorTier = "elite" | "normal";

/** Lessons.status 중 isTrial=TRUE 인 행의 distinct 값 (2026-07-25) */
export type TrialStatus = "approved" | "canceled" | "completed" | "paid";

/** [1차, 2차, 3차] pre-trial call 진행 여부. automation.trial_dashboard_state.pre_trial_call_checks */
export type PreTrialCallChecks = [boolean, boolean, boolean];

/** GET /api/trials → n8n GET /webhook/trials 의 trials[] 원소 */
export interface TrialListItem {
  trial_id: string;
  /** ISO8601, KST 오프셋 포함. 예: "2026-07-25T18:00:00+09:00" */
  trial_time: string;
  student_id: string;
  /** Students.firstName+lastName, 없으면 koreanEquivalent */
  student_name: string;
  student_email: string;
  student_phone_number: string;
  mentor_name: string;
  mentor_tier: MentorTier;
  /** 담당 Sales rep 표시명 (CallQueues 담당 admin → Users.email local-part) */
  sales_rep_name: string;
  status: TrialStatus;
  pre_trial_call_checks: PreTrialCallChecks;
  converted: boolean;
}

export interface TrialsTodayResponse {
  trials: TrialListItem[];
}

/** GET /api/trials/{id} → n8n GET /webhook/<hookId>/trials/<id> */
export interface TrialDetail {
  trial_id: string;
  student_id: string;
  /** Students.firstName+lastName, 없으면 koreanEquivalent */
  student_name: string;
  student_email: string;
  student_phone_number: string;
  /** Students.level(+langLevel) 조합. 예: "1 · Beginner-High" */
  level: string;
  mentor_id: string;
  mentor_name: string;
  /** Mentors.gender — 라이브 distinct: female, male, nonbinary */
  mentor_gender: string;
  /** CallQueues.answersJson.interests */
  interests: string[];
  /** ISO8601 date (KST 기준). 예: "2026-07-25" */
  trial_date: string;
  /** 학생 추가정보/세일즈 메모 (automation.trial_dashboard_state.sales_note). 미기록이면 null. */
  sales_note: string | null;
}

/** pre-trial call 저장 단계 */
export type PreTrialCallStage = 1 | 2 | 3;

/**
 * PATCH /api/trials/{id}/pre-trial-call-check body.
 * **trial_id 는 경로 파라미터다 — body 에 없다.**
 */
export interface PreTrialCallCheckRequest {
  stage: PreTrialCallStage;
  checked: boolean;
}

export interface PreTrialCallCheckResponse {
  ok: true;
  trial_id: string;
  stage: PreTrialCallStage;
  checked: boolean;
}

/**
 * PATCH /api/trials/{id}/note body — 학생 추가정보 저장.
 * **trial_id 는 경로 파라미터다 — body 에 없다.**
 */
export interface NoteRequest {
  /** 자유서술 메모. 빈 문자열이면 기록 삭제로 취급. */
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
