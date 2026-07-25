// 목록 데이터로 상단 카드 수치를 프론트에서 집계 (PRD §6.1 — 별도 집계 API 없음).
import type { TrialListItem } from "@/types/trial";
import { isCanceled } from "./format";

export interface TrialStats {
  /** 오늘 trial 총 수 (취소 제외) */
  total: number;
  /** 오늘 남은 trial 수 — 체크마크(1·2·3)가 하나도 안 된 활성 trial (하나라도 체크되면 제외) */
  remaining: number;
  /** 취소 건수 */
  canceled: number;
  /** 오늘 전환(구매) 수 */
  converted: number;
}

export function computeStats(trials: TrialListItem[]): TrialStats {
  return trials.reduce<TrialStats>(
    (acc, t) => {
      if (isCanceled(t)) {
        acc.canceled += 1;
        return acc;
      }
      acc.total += 1;
      // 체크마크가 하나도 없으면 "아직 손대지 않은" 남은 trial
      if (!t.precheck_1 && !t.precheck_2 && !t.precheck_3) acc.remaining += 1;
      if (t.converted) acc.converted += 1;
      return acc;
    },
    { total: 0, remaining: 0, canceled: 0, converted: 0 },
  );
}
