"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { savePrecheck } from "@/lib/api";
import type {
  PrecheckRequest,
  PrecheckStage,
  TrialsTodayResponse,
} from "@/types/trial";
import { trialKeys } from "./queryKeys";

function stageKey(stage: PrecheckStage) {
  return `precheck_${stage}` as const;
}

/**
 * Pre-trial 체크 저장 — Optimistic Update (PRD §5).
 * 캐시를 먼저 수정하고, 실패 시 롤백 + 토스트. 성공해도 재조회하지 않는다
 * (본인 조작 즉시 반영, n8n 재호출 억제).
 */
export function usePrecheckMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: savePrecheck,
    onMutate: async (vars: PrecheckRequest) => {
      await qc.cancelQueries({ queryKey: trialKeys.list() });
      const prev = qc.getQueryData<TrialsTodayResponse>(trialKeys.list());

      qc.setQueryData<TrialsTodayResponse>(trialKeys.list(), (old) =>
        old
          ? {
              trials: old.trials.map((t) =>
                t.trial_id === vars.trial_id
                  ? { ...t, [stageKey(vars.stage)]: vars.checked }
                  : t,
              ),
            }
          : old,
      );

      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(trialKeys.list(), ctx.prev);
      toast.error("체크 저장 실패 — 이전 상태로 되돌렸습니다", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}
