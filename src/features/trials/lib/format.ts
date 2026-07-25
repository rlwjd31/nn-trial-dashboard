// trials 도메인 표시용 순수 포맷 함수.
import type { MentorTier, TrialListItem } from "@/types/trial";

/** trial_time(ISO, +09:00) → "14:00" (KST 시:분) */
export function formatTrialTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

// 글래스모피즘 배지(칩) 스타일. 솔리드 대신 반투명 틴트 + 얇은 테두리 + 살짝 blur.
// 글자색은 각 색조의 아주 밝은 톤(…-50/100)으로 보라 배경 위에서도 또렷하게.
const CHIP_BASE = "border backdrop-blur-sm";

/** 도메인 무관 중립 글래스 칩 (interests 등) */
export const CHIP_NEUTRAL = `${CHIP_BASE} bg-white/10 text-white/85 border-white/20`;

/**
 * Lessons.status → 표시 라벨 + 글래스 칩 className.
 * 값은 approved|canceled|completed|paid (계약 TrialStatus). 알 수 없는 값은 원문 그대로 보여준다.
 */
export function statusMeta(status: string): {
  label: string;
  className: string;
} {
  switch (status) {
    case "approved":
      return {
        label: "Approved",
        className: `${CHIP_BASE} bg-sky-400/15 text-sky-100 border-sky-300/30`,
      };
    case "completed":
      return {
        label: "Completed",
        className: `${CHIP_BASE} bg-emerald-400/15 text-emerald-100 border-emerald-300/30`,
      };
    case "paid":
      return {
        label: "Paid",
        className: `${CHIP_BASE} bg-violet-400/20 text-violet-100 border-violet-300/30`,
      };
    case "canceled":
    case "cancelled":
      return {
        label: "Canceled",
        className: `${CHIP_BASE} bg-rose-400/15 text-rose-100 border-rose-300/30`,
      };
    default:
      return { label: status, className: CHIP_NEUTRAL };
  }
}

/**
 * MentorTier → 표시 라벨 + 글래스 칩 className.
 *
 * ⚠ DB 값과 화면 라벨은 다르다: 값은 `elite | normal`(라이브 distinct)이지만
 * 제품 용어는 elite/basic 이므로 **라벨은 "Basic" 을 유지**한다. 값이 바뀐 것이지 UI 용어가 바뀐 게 아니다.
 */
export function tierMeta(tier: MentorTier): {
  label: string;
  className: string;
} {
  return tier === "elite"
    ? {
        label: "Elite",
        // 테마(보라)와 어울리는 앰버 글래스 → "프리미엄" 위계
        className: `${CHIP_BASE} bg-amber-300/20 text-amber-100 border-amber-200/30`,
      }
    : {
        label: "Basic",
        className: `${CHIP_BASE} bg-white/8 text-white/70 border-white/15`,
      };
}

/** 취소된 trial 여부 (체크박스 비활성화 판단 등). 실데이터 철자는 `canceled`(L 하나). */
export function isCanceled(trial: Pick<TrialListItem, "status">): boolean {
  return trial.status === "canceled";
}
