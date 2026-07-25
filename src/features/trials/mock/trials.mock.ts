// ─────────────────────────────────────────────────────────────────────────
// Mock 응답 (N8N_BASE_URL 미설정 시 Route Handler 가 이걸 서빙한다).
// 모양은 docs/contract/openapi.yaml 을 따른다 — `pnpm test:contract` 가 이 파일의
// 출력을 스펙과 직접 대조하므로, 스펙을 고치면 여기도 같이 고쳐야 한다.
//
// 필드 → 실제 DB 출처 (라이브 검증 2026-07-25, docs/backend/data-layer.md):
//   trial_id             ← public."Lessons".id                (isTrial = TRUE)
//   trial_time           ← "Lessons"."startAt"                (naive UTC → KST 변환 필요)
//   trial_date           ← "Lessons"."startAt" 의 KST 날짜
//   status               ← "Lessons".status                   trial 실측: approved|canceled|completed|paid
//   student_id           ← "Students".id
//   student_name         ← "Students".firstName+lastName, 없으면 "koreanEquivalent"
//   level                ← "Students".level (+ "langLevel")
//   student_email        ← "Users".email                      (Students.userId → Users)
//   student_phone_number ← "Users"."phoneNumber"
//   mentor_id / mentor_name / mentor_tier / mentor_gender ← "Mentors"(firstName+lastName, tier, gender)
//                          tier 실측: elite|normal · gender 실측: female|male|nonbinary
//   sales_rep_name       ← "CallQueues".claimedByAdminId / autoAssignedToId → "Users".email local-part
//   interests            ← "CallQueues"."answersJson".interests
//   converted            ← "CallQueues".lifecycle='converted' OR purchasedAt IS NOT NULL
//   pre_trial_call_checks ← automation.trial_dashboard_state.pre_trial_call_checks
//   sales_note            ← automation.trial_dashboard_state.sales_note
// ─────────────────────────────────────────────────────────────────────────

import type {
  MentorTier,
  PreTrialCallChecks,
  PreTrialCallStage,
  TrialDetail,
  TrialListItem,
  TrialsTodayResponse,
  TrialStatus,
} from "@/types/trial";

interface TrialSeed {
  trial_id: string;
  /** startAt 시각 (KST, 오늘 날짜에 매핑됨) */
  hour: number;
  minute: number;
  student_id: string;
  student_name: string;
  student_email: string;
  student_phone_number: string;
  mentor_id: string;
  mentor_name: string;
  mentor_tier: MentorTier;
  mentor_gender: string;
  status: TrialStatus;
  pre_trial_call_checks: PreTrialCallChecks;
  converted: boolean;
  // detail 전용
  level: string;
  interests: string[];
}

// 오늘의 trial 12건. 상태·티어·체크 상태를 골고루 섞어 대시보드 집계가 의미 있도록 구성.
const SEED: TrialSeed[] = [
  {
    trial_id: "48213",
    hour: 9,
    minute: 0,
    student_id: "10432",
    student_name: "Jiwoo Park",
    student_email: "jiwoo.parent@gmail.com",
    student_phone_number: "+82 10-2345-6789",
    mentor_id: "512",
    mentor_name: "Emma Wilson",
    mentor_tier: "elite",
    mentor_gender: "female",
    status: "paid",
    pre_trial_call_checks: [true, true, true],
    converted: true,
    level: "3 · Beginner-High",
    interests: ["Minecraft", "Dinosaurs", "Soccer"],
  },
  {
    trial_id: "48219",
    hour: 10,
    minute: 30,
    student_id: "10517",
    student_name: "Seoyeon Kim",
    student_email: "seoyeon.mom@naver.com",
    student_phone_number: "+82 10-8821-4402",
    mentor_id: "530",
    mentor_name: "James Carter",
    mentor_tier: "normal",
    mentor_gender: "male",
    status: "completed",
    pre_trial_call_checks: [true, true, false],
    converted: true,
    level: "2 · Beginner",
    interests: ["K-pop", "Drawing", "Animals"],
  },
  {
    trial_id: "48224",
    hour: 11,
    minute: 0,
    student_id: "10588",
    student_name: "Dohyun Kim",
    student_email: "dohyun.kim82@gmail.com",
    student_phone_number: "+82 10-3390-1188",
    mentor_id: "512",
    mentor_name: "Emma Wilson",
    mentor_tier: "elite",
    mentor_gender: "female",
    status: "completed",
    pre_trial_call_checks: [true, false, false],
    converted: false,
    level: "4 · Intermediate-Low",
    interests: ["Harry Potter", "Space", "Coding"],
  },
  {
    trial_id: "48231",
    hour: 13,
    minute: 0,
    student_id: "10602",
    student_name: "Yuna Lee",
    student_email: "yuna.lee.family@gmail.com",
    student_phone_number: "+82 10-7742-9931",
    mentor_id: "544",
    mentor_name: "Olivia Bennett",
    mentor_tier: "elite",
    mentor_gender: "female",
    status: "approved",
    pre_trial_call_checks: [true, true, false],
    converted: false,
    level: "1 · Starter",
    interests: ["Roblox", "Cooking"],
  },
  {
    trial_id: "48236",
    hour: 14,
    minute: 0,
    student_id: "10644",
    student_name: "Minjun Choi",
    student_email: "minjun.parent@kakao.com",
    student_phone_number: "+82 10-2201-5567",
    mentor_id: "530",
    mentor_name: "James Carter",
    mentor_tier: "normal",
    mentor_gender: "male",
    status: "approved",
    pre_trial_call_checks: [true, false, false],
    converted: false,
    level: "3 · Beginner-High",
    interests: ["Soccer", "Pokemon", "Science"],
  },
  {
    trial_id: "48240",
    hour: 15,
    minute: 30,
    student_id: "10671",
    student_name: "Hayoon Jung",
    student_email: "hayoon.mom2@naver.com",
    student_phone_number: "+82 10-9987-1120",
    mentor_id: "558",
    mentor_name: "Sophia Nguyen",
    mentor_tier: "elite",
    mentor_gender: "nonbinary",
    status: "approved",
    pre_trial_call_checks: [false, false, false],
    converted: false,
    level: "2 · Beginner",
    interests: ["Art", "Music", "Cats"],
  },
  {
    trial_id: "48245",
    hour: 16,
    minute: 0,
    student_id: "10688",
    student_name: "Seojun Kim",
    student_email: "seojun.kim.dad@gmail.com",
    student_phone_number: "+82 10-4456-7788",
    mentor_id: "561",
    mentor_name: "Liam Turner",
    mentor_tier: "normal",
    mentor_gender: "male",
    status: "approved",
    pre_trial_call_checks: [true, true, true],
    converted: false,
    level: "5 · Intermediate",
    interests: ["Basketball", "YouTube", "Robots"],
  },
  {
    trial_id: "48249",
    hour: 17,
    minute: 0,
    student_id: "10702",
    student_name: "Chaewon Han",
    student_email: "chaewon.family@naver.com",
    student_phone_number: "+82 10-3322-6655",
    mentor_id: "544",
    mentor_name: "Olivia Bennett",
    mentor_tier: "elite",
    mentor_gender: "female",
    status: "canceled",
    pre_trial_call_checks: [false, false, false],
    converted: false,
    level: "1 · Starter",
    interests: ["Disney", "Baking"],
  },
  {
    trial_id: "48253",
    hour: 18,
    minute: 0,
    student_id: "10744",
    student_name: "Junseo Oh",
    student_email: "junseo.parent7@gmail.com",
    student_phone_number: "+82 10-6610-2299",
    mentor_id: "530",
    mentor_name: "James Carter",
    mentor_tier: "normal",
    mentor_gender: "male",
    status: "approved",
    pre_trial_call_checks: [true, false, false],
    converted: false,
    level: "3 · Beginner-High",
    interests: ["Cars", "Lego", "Dinosaurs"],
  },
  {
    trial_id: "48258",
    hour: 19,
    minute: 0,
    student_id: "10769",
    student_name: "Eunwoo Shin",
    student_email: "eunwoo.mom@kakao.com",
    student_phone_number: "+82 10-1145-8890",
    mentor_id: "558",
    mentor_name: "Sophia Nguyen",
    mentor_tier: "elite",
    mentor_gender: "nonbinary",
    status: "approved",
    pre_trial_call_checks: [false, false, false],
    converted: false,
    level: "4 · Intermediate-Low",
    interests: ["Swimming", "Comics", "Space"],
  },
  {
    trial_id: "48261",
    hour: 19,
    minute: 30,
    student_id: "10781",
    student_name: "Sohee Yoon",
    student_email: "ssohee.family@naver.com",
    student_phone_number: "+82 10-7788-3410",
    mentor_id: "561",
    mentor_name: "Liam Turner",
    mentor_tier: "normal",
    mentor_gender: "male",
    status: "approved",
    pre_trial_call_checks: [false, false, false],
    converted: false,
    level: "2 · Beginner",
    interests: ["Ballet", "Puppies"],
  },
  {
    trial_id: "48264",
    hour: 20,
    minute: 0,
    student_id: "10799",
    student_name: "Taeyang Kang",
    student_email: "taeyang.parent@gmail.com",
    student_phone_number: "+82 10-9901-4423",
    mentor_id: "512",
    mentor_name: "Emma Wilson",
    mentor_tier: "elite",
    mentor_gender: "female",
    status: "approved",
    pre_trial_call_checks: [true, true, false],
    converted: false,
    level: "6 · Intermediate-High",
    interests: ["Chess", "Astronomy", "Guitar"],
  },
];

// ── pre-trial call check 인메모리 오버라이드 (dev 서버 프로세스 동안 유지) ─────
// n8n 연동 전까지 PATCH 결과를 이 Map 에 반영해, 목록 재조회 시에도 값이 유지되게 한다.
const preTrialCallOverrides = new Map<
  string,
  Partial<Record<PreTrialCallStage, boolean>>
>();

// ── 학생 추가정보(세일즈 메모) 인메모리 저장 ─────────────────────────────────
// 실제로는 automation.trial_dashboard_state.sales_note. 초기 시드 + PATCH /note 결과를 반영.
const salesNotes = new Map<string, string>([
  ["48213", "결제 완료. 다음 정규수업 화/목 저녁 선호. 부모님 영어 학습 열의 높음."],
  ["48224", "레벨 대비 자신감 낮음 — 첫 수업 아이스브레이킹 여유있게 요청."],
  ["48236", "형이 이미 수강 중(만족). 가격 문의 있었음 → 프로모션 안내 예정."],
]);

/** KST 기준 오늘 날짜 문자열 "YYYY-MM-DD" */
function todayKstDate(now: Date): string {
  // en-CA 로케일 → "YYYY-MM-DD" 형식
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** 시드값 위에 PATCH 오버라이드를 얹은 [1차,2차,3차] */
function checksOf(seed: TrialSeed): PreTrialCallChecks {
  const override = preTrialCallOverrides.get(seed.trial_id);
  const at = (stage: PreTrialCallStage) =>
    override?.[stage] ?? seed.pre_trial_call_checks[stage - 1];
  return [at(1), at(2), at(3)];
}

// mock 전용: Sales rep 배정 (Andrew / HyeonChang). 실제로는 CallQueues 담당자 조인.
const SALES_REP_BY_INDEX = [
  "Andrew", "HyeonChang", "HyeonChang", "Andrew",
  "HyeonChang", "Andrew", "Andrew", "HyeonChang",
  "Andrew", "HyeonChang", "HyeonChang", "Andrew",
];

function toListItem(
  seed: TrialSeed,
  dateStr: string,
  index: number,
): TrialListItem {
  return {
    trial_id: seed.trial_id,
    trial_time: `${dateStr}T${pad(seed.hour)}:${pad(seed.minute)}:00+09:00`,
    student_id: seed.student_id,
    student_name: seed.student_name,
    student_email: seed.student_email,
    student_phone_number: seed.student_phone_number,
    mentor_name: seed.mentor_name,
    mentor_tier: seed.mentor_tier,
    sales_rep_name: SALES_REP_BY_INDEX[index] ?? "Andrew",
    status: seed.status,
    pre_trial_call_checks: checksOf(seed),
    converted: seed.converted,
  };
}

/**
 * GET /api/trials (n8n /webhook/trials) 대체 — 오늘의 trial 목록.
 *
 * 정렬은 `trial_time` **내림차순**이다 — 콜 리스트라 늦은 시각이 상단에 온다(openapi 에 명시).
 * SEED 는 읽기 편하도록 오름차순으로 두고 여기서 뒤집는다. 같은 날짜·같은 오프셋 문자열이라
 * 사전순 비교가 곧 시간순 비교다.
 */
export function getMockTrialsToday(now: Date = new Date()): TrialsTodayResponse {
  const dateStr = todayKstDate(now);
  return {
    trials: SEED.map((s, i) => toListItem(s, dateStr, i)).sort((a, b) =>
      b.trial_time.localeCompare(a.trial_time),
    ),
  };
}

/** GET /api/trials/{id} (n8n /webhook/<hookId>/trials/<id>) 대체 — 단건 상세 (없으면 null) */
export function getMockTrialDetail(
  trialId: string,
  now: Date = new Date(),
): TrialDetail | null {
  const seed = SEED.find((s) => s.trial_id === trialId);
  if (!seed) return null;
  return {
    trial_id: seed.trial_id,
    student_id: seed.student_id,
    student_name: seed.student_name,
    student_email: seed.student_email,
    student_phone_number: seed.student_phone_number,
    level: seed.level,
    mentor_id: seed.mentor_id,
    mentor_name: seed.mentor_name,
    mentor_gender: seed.mentor_gender,
    interests: seed.interests,
    trial_date: todayKstDate(now),
    sales_note: salesNotes.get(seed.trial_id) ?? null,
  };
}

/** PATCH /webhook/trials/pre-trial-call-check 대체 — 오버라이드 저장 후 에코 */
export function setMockPreTrialCallCheck(
  trialId: string,
  stage: PreTrialCallStage,
  checked: boolean,
): boolean {
  const seed = SEED.find((s) => s.trial_id === trialId);
  if (!seed) return false;
  const current = preTrialCallOverrides.get(trialId) ?? {};
  current[stage] = checked;
  preTrialCallOverrides.set(trialId, current);
  return true;
}

/** PATCH /webhook/trials/note 대체 — 학생 추가정보 저장 후 에코 (없으면 false) */
export function setMockNote(trialId: string, note: string): boolean {
  const seed = SEED.find((s) => s.trial_id === trialId);
  if (!seed) return false;
  const trimmed = note.trim();
  if (trimmed) salesNotes.set(trialId, trimmed);
  else salesNotes.delete(trialId);
  return true;
}
