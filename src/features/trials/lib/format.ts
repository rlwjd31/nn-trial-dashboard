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

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

/** Lessons.status → 표시 라벨 + Badge variant */
export function statusMeta(status: string): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case "approved":
      return { label: "Completed", variant: "default" };
    case "scheduled":
      return { label: "Scheduled", variant: "secondary" };
    case "canceled":
    case "cancelled":
      return { label: "Canceled", variant: "destructive" };
    default:
      return { label: status, variant: "outline" };
  }
}

/** MentorTier → 표시 라벨 + Badge variant */
export function tierMeta(tier: MentorTier): {
  label: string;
  variant: BadgeVariant;
} {
  return tier === "elite"
    ? { label: "Elite", variant: "default" }
    : { label: "Basic", variant: "outline" };
}

/** 취소된 trial 여부 (체크박스 비활성화 판단 등) */
export function isCanceled(trial: Pick<TrialListItem, "status">): boolean {
  return trial.status === "canceled" || trial.status === "cancelled";
}
