// 목록 데이터로 상단 카드 수치를 프론트에서 집계 (PRD §6.1 — 별도 집계 API 없음).
import type { TrialListItem } from "@/types/trial";
import { isCanceled } from "./format";

export interface TrialStats {
  /** 오늘 trial 총 수 (취소 제외) */
  total: number;
  /** 취소 건수 */
  canceled: number;
  /** pre-call 완료 수 */
  preCallDone: number;
  /** post-call 완료 수 */
  postCallDone: number;
  /** 오늘 전환 수 */
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
      if (t.pre_call_done) acc.preCallDone += 1;
      if (t.post_call_done) acc.postCallDone += 1;
      if (t.converted) acc.converted += 1;
      return acc;
    },
    { total: 0, canceled: 0, preCallDone: 0, postCallDone: 0, converted: 0 },
  );
}
