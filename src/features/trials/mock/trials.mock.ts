// ─────────────────────────────────────────────────────────────────────────
// Mock 데이터 (임시). 나중에 n8n backend layer 응답으로 교체된다.
//
// 필드 → 실제 DB 스키마 출처 (../../../../n8n-workflows/docs/schema/public):
//   trial_id             ← "Lessons".id            (isTrial = TRUE 인 행)
//   trial_time           ← "Lessons"."startAt"     (수업 시작 시각)
//   trial_date           ← "Lessons"."startAt"::date
//   status               ← "Lessons".status        (scheduled | approved | canceled)
//                          ⚠ 취소값 실데이터 철자는 'canceled'(L 하나) — lessons.md §샘플 참조
//   student_id           ← "Students".id
//   student_name         ← "Students"."firstName" + "lastName" (표시용 조합)
//   level                ← "Students".level (+ "langLevel" 텍스트)
//   student_email        ← "Users".email           (Students.userId → Users)
//   student_phone_number ← "Users"."phoneNumber"
//   mentor_id            ← "Lessons"."mentorId"
//   mentor_name          ← "CalendlyEvents"."mentorName" (예약 스냅샷) / "Mentors"
//   mentor_tier          ← "Mentors".tier          ("MentorTier" enum = elite | basic)
//   mentor_gender        ← "Mentors".gender        ("GenderType")
//   sales_rep_name       ← "CallQueues".claimedByAdminId / autoAssignedToId → "Users"(admin)
//                          (+ SalesRepConfigs). mock: Andrew / HyeonChang 랜덤 배정.
//   interests            ← "CallQueues"."answersJson".interests (온보딩 설문)
//   converted            ← "CallQueues".lifecycle = 'converted' / purchasedAt IS NOT NULL
//   pre_call_done        ← 세일즈 pre-call 완료 (판정 기준 PRD §9 미확정)
//   post_call_done       ← 세일즈 post-call 완료 (판정 기준 PRD §9 미확정)
//   precheck_1/2/3       ← pre-trial 체크 (저장 위치 PRD §9 미확정)
//   call_queue_url       ← "CallQueues".id 기반 세일즈 콜 큐 딥링크
//
// ⚠ Mentors 테이블 전용 스키마 문서는 없음(users.md가 Mentors 존재만 언급).
//    mentor_name/tier/gender 는 위 참조 컬럼을 근거로 한 그럴듯한 합성값이다.
// ─────────────────────────────────────────────────────────────────────────

import type {
  MentorTier,
  PrecheckStage,
  TrialDetail,
  TrialListItem,
  TrialsTodayResponse,
} from "@/types/trial";

interface TrialSeed {
  trial_id: string;
  /** startAt 시각 (KST, 오늘 날짜에 매핑됨) */
  hour: number;
  minute: number;
  student_id: string;
  /** Students.firstName */
  student_first_name: string;
  /** Students.lastName */
  student_last_name: string;
  student_email: string;
  student_phone_number: string;
  mentor_id: string;
  mentor_name: string;
  mentor_tier: MentorTier;
  mentor_gender: string;
  status: string;
  precheck_1: boolean;
  precheck_2: boolean;
  precheck_3: boolean;
  pre_call_done: boolean;
  post_call_done: boolean;
  converted: boolean;
  // detail 전용
  level: string;
  interests: string[];
  call_queue_id: number;
}

// 오늘의 trial 12건. 상태·티어·체크 상태를 골고루 섞어 대시보드 집계가 의미 있도록 구성.
const SEED: TrialSeed[] = [
  {
    trial_id: "48213",
    hour: 9,
    minute: 0,
    student_id: "20443",
    student_first_name: "Hyeong Chang",
    student_last_name: "Lim",
    student_email: "hyeonchang2002@gmail.com",
    student_phone_number: "+82 10-9469-4696",
    mentor_id: "512",
    mentor_name: "Emma Wilson",
    mentor_tier: "elite",
    mentor_gender: "female",
    status: "approved",
    precheck_1: true,
    precheck_2: true,
    precheck_3: true,
    pre_call_done: true,
    post_call_done: true,
    converted: true,
    level: "3 · Beginner-High",
    interests: ["Minecraft", "Dinosaurs", "Soccer"],
    call_queue_id: 10432,
  },
  {
    trial_id: "48219",
    hour: 10,
    minute: 30,
    student_id: "22238",
    student_first_name: "Andrew",
    student_last_name: "Park",
    student_email: "andrew@naonow.com",
    student_phone_number: "+82 10-8347-2178",
    mentor_id: "530",
    mentor_name: "James Carter",
    mentor_tier: "basic",
    mentor_gender: "male",
    status: "approved",
    precheck_1: true,
    precheck_2: true,
    precheck_3: false,
    pre_call_done: true,
    post_call_done: true,
    converted: true,
    level: "2 · Beginner",
    interests: ["K-pop", "Drawing", "Animals"],
    call_queue_id: 10517,
  },
  {
    trial_id: "48224",
    hour: 11,
    minute: 0,
    student_id: "13381",
    student_first_name: "Logan",
    student_last_name: "Park",
    student_email: "logan@naonow.com",
    student_phone_number: "+82 10-4029-2178",
    mentor_id: "512",
    mentor_name: "Emma Wilson",
    mentor_tier: "elite",
    mentor_gender: "female",
    status: "approved",
    precheck_1: true,
    precheck_2: false,
    precheck_3: false,
    pre_call_done: true,
    post_call_done: false,
    converted: false,
    level: "4 · Intermediate-Low",
    interests: ["Harry Potter", "Space", "Coding"],
    call_queue_id: 10588,
  },
  {
    trial_id: "48231",
    hour: 13,
    minute: 0,
    student_id: "10602",
    student_first_name: "Yuna",
    student_last_name: "Lee",
    student_email: "yuna.lee.family@gmail.com",
    student_phone_number: "+82 10-7742-9931",
    mentor_id: "544",
    mentor_name: "Olivia Bennett",
    mentor_tier: "elite",
    mentor_gender: "female",
    status: "scheduled",
    precheck_1: true,
    precheck_2: true,
    precheck_3: false,
    pre_call_done: true,
    post_call_done: false,
    converted: false,
    level: "1 · Starter",
    interests: ["Roblox", "Cooking"],
    call_queue_id: 10602,
  },
  {
    trial_id: "48236",
    hour: 14,
    minute: 0,
    student_id: "10644",
    student_first_name: "Minjun",
    student_last_name: "Park",
    student_email: "minjun.parent@kakao.com",
    student_phone_number: "+82 10-2201-5567",
    mentor_id: "530",
    mentor_name: "James Carter",
    mentor_tier: "basic",
    mentor_gender: "male",
    status: "scheduled",
    precheck_1: true,
    precheck_2: false,
    precheck_3: false,
    pre_call_done: false,
    post_call_done: false,
    converted: false,
    level: "3 · Beginner-High",
    interests: ["Soccer", "Pokemon", "Science"],
    call_queue_id: 10644,
  },
  {
    trial_id: "48240",
    hour: 15,
    minute: 30,
    student_id: "10671",
    student_first_name: "Hayoon",
    student_last_name: "Jung",
    student_email: "hayoon.mom2@naver.com",
    student_phone_number: "+82 10-9987-1120",
    mentor_id: "558",
    mentor_name: "Sophia Nguyen",
    mentor_tier: "elite",
    mentor_gender: "female",
    status: "scheduled",
    precheck_1: false,
    precheck_2: false,
    precheck_3: false,
    pre_call_done: false,
    post_call_done: false,
    converted: false,
    level: "2 · Beginner",
    interests: ["Art", "Music", "Cats"],
    call_queue_id: 10671,
  },
  {
    trial_id: "48245",
    hour: 16,
    minute: 0,
    student_id: "10688",
    student_first_name: "Seojun",
    student_last_name: "Kim",
    student_email: "seojun.kim.dad@gmail.com",
    student_phone_number: "+82 10-4456-7788",
    mentor_id: "561",
    mentor_name: "Liam Turner",
    mentor_tier: "basic",
    mentor_gender: "male",
    status: "scheduled",
    precheck_1: true,
    precheck_2: true,
    precheck_3: true,
    pre_call_done: true,
    post_call_done: false,
    converted: false,
    level: "5 · Intermediate",
    interests: ["Basketball", "YouTube", "Robots"],
    call_queue_id: 10688,
  },
  {
    trial_id: "48249",
    hour: 17,
    minute: 0,
    student_id: "10702",
    student_first_name: "Chaewon",
    student_last_name: "Choi",
    student_email: "chaewon.family@naver.com",
    student_phone_number: "+82 10-3322-6655",
    mentor_id: "544",
    mentor_name: "Olivia Bennett",
    mentor_tier: "elite",
    mentor_gender: "female",
    status: "canceled",
    precheck_1: false,
    precheck_2: false,
    precheck_3: false,
    pre_call_done: false,
    post_call_done: false,
    converted: false,
    level: "1 · Starter",
    interests: ["Disney", "Baking"],
    call_queue_id: 10702,
  },
  {
    trial_id: "48253",
    hour: 18,
    minute: 0,
    student_id: "10744",
    student_first_name: "Junseo",
    student_last_name: "Kang",
    student_email: "junseo.parent7@gmail.com",
    student_phone_number: "+82 10-6610-2299",
    mentor_id: "530",
    mentor_name: "James Carter",
    mentor_tier: "basic",
    mentor_gender: "male",
    status: "scheduled",
    precheck_1: true,
    precheck_2: false,
    precheck_3: false,
    pre_call_done: false,
    post_call_done: false,
    converted: false,
    level: "3 · Beginner-High",
    interests: ["Cars", "Lego", "Dinosaurs"],
    call_queue_id: 10744,
  },
  {
    trial_id: "48258",
    hour: 19,
    minute: 0,
    student_id: "10769",
    student_first_name: "Eunwoo",
    student_last_name: "Cho",
    student_email: "eunwoo.mom@kakao.com",
    student_phone_number: "+82 10-1145-8890",
    mentor_id: "558",
    mentor_name: "Sophia Nguyen",
    mentor_tier: "elite",
    mentor_gender: "female",
    status: "scheduled",
    precheck_1: false,
    precheck_2: false,
    precheck_3: false,
    pre_call_done: false,
    post_call_done: false,
    converted: false,
    level: "4 · Intermediate-Low",
    interests: ["Swimming", "Comics", "Space"],
    call_queue_id: 10769,
  },
  {
    trial_id: "48261",
    hour: 19,
    minute: 30,
    student_id: "10781",
    student_first_name: "Sohee",
    student_last_name: "Yoon",
    student_email: "ssohee.family@naver.com",
    student_phone_number: "+82 10-7788-3410",
    mentor_id: "561",
    mentor_name: "Liam Turner",
    mentor_tier: "basic",
    mentor_gender: "male",
    status: "scheduled",
    precheck_1: false,
    precheck_2: false,
    precheck_3: false,
    pre_call_done: false,
    post_call_done: false,
    converted: false,
    level: "2 · Beginner",
    interests: ["Ballet", "Puppies"],
    call_queue_id: 10781,
  },
  {
    trial_id: "48264",
    hour: 20,
    minute: 0,
    student_id: "10799",
    student_first_name: "Taeyang",
    student_last_name: "Han",
    student_email: "taeyang.parent@gmail.com",
    student_phone_number: "+82 10-9901-4423",
    mentor_id: "512",
    mentor_name: "Emma Wilson",
    mentor_tier: "elite",
    mentor_gender: "female",
    status: "scheduled",
    precheck_1: true,
    precheck_2: true,
    precheck_3: false,
    pre_call_done: true,
    post_call_done: false,
    converted: false,
    level: "6 · Intermediate-High",
    interests: ["Chess", "Astronomy", "Guitar"],
    call_queue_id: 10799,
  },
];

// ── precheck 인메모리 오버라이드 (dev 서버 프로세스 동안 유지) ────────────────
// n8n 도입 전까지 PATCH 결과를 이 Map 에 반영해, 목록 재조회 시에도 값이 유지되게 한다.
const precheckOverrides = new Map<string, Partial<Record<PrecheckStage, boolean>>>();

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

/** firstName + lastName → 표시용 이름 (로마자 표기: "Given Family"). */
function studentName(seed: TrialSeed): string {
  return `${seed.student_first_name} ${seed.student_last_name}`;
}

function precheckOf(seed: TrialSeed, stage: PrecheckStage): boolean {
  const override = precheckOverrides.get(seed.trial_id)?.[stage];
  if (override !== undefined) return override;
  return seed[`precheck_${stage}` as const];
}

// mock 전용: Sales rep 랜덤 배정 (Andrew / HyeonChang). 실제로는 CallQueues 담당자 조인.
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
    student_name: studentName(seed),
    student_email: seed.student_email,
    student_phone_number: seed.student_phone_number,
    mentor_name: seed.mentor_name,
    mentor_tier: seed.mentor_tier,
    sales_rep_name: SALES_REP_BY_INDEX[index] ?? "Andrew",
    status: seed.status,
    precheck_1: precheckOf(seed, 1),
    precheck_2: precheckOf(seed, 2),
    precheck_3: precheckOf(seed, 3),
    pre_call_done: seed.pre_call_done,
    post_call_done: seed.post_call_done,
    converted: seed.converted,
  };
}

/** GET /webhook/trials/today 대체 — 오늘의 trial 목록 */
export function getMockTrialsToday(now: Date = new Date()): TrialsTodayResponse {
  const dateStr = todayKstDate(now);
  return { trials: SEED.map((s, i) => toListItem(s, dateStr, i)) };
}

/** GET /webhook/trials/detail 대체 — 단건 상세 (없으면 null) */
export function getMockTrialDetail(
  trialId: string,
  now: Date = new Date(),
): TrialDetail | null {
  const seed = SEED.find((s) => s.trial_id === trialId);
  if (!seed) return null;
  return {
    trial_id: seed.trial_id,
    student_id: seed.student_id,
    student_name: studentName(seed),
    student_email: seed.student_email,
    student_phone_number: seed.student_phone_number,
    level: seed.level,
    mentor_id: seed.mentor_id,
    mentor_name: seed.mentor_name,
    mentor_gender: seed.mentor_gender,
    interests: seed.interests,
    trial_date: todayKstDate(now),
    call_queue_url: `https://app.naonow.com/sales/call-queue/${seed.call_queue_id}`,
  };
}

/** PATCH /webhook/trials/precheck 대체 — 오버라이드 저장 후 에코 */
export function setMockPrecheck(
  trialId: string,
  stage: PrecheckStage,
  checked: boolean,
): boolean {
  const seed = SEED.find((s) => s.trial_id === trialId);
  if (!seed) return false;
  const current = precheckOverrides.get(trialId) ?? {};
  current[stage] = checked;
  precheckOverrides.set(trialId, current);
  return true;
}
