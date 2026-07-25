"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { savePreTrialCallCheck } from "@/lib/api";
import type {
  PreTrialCallCheckRequest,
  TrialsTodayResponse,
} from "@/types/trial";
import { trialKeys } from "./queryKeys";

/**
 * 훅의 variables 는 요청 body 와 다르다 — `trial_id` 는 경로로 나가지만
 * optimistic 갱신에 필요하므로 variables 에는 남긴다.
 */
type Vars = { trial_id: string } & PreTrialCallCheckRequest;

/**
 * Pre-trial call 체크 저장 — Optimistic Update (PRD §5).
 * 캐시를 먼저 수정하고, 실패 시 롤백 + 토스트. 성공해도 재조회하지 않는다
 * (본인 조작 즉시 반영, n8n 재호출 억제).
 */
export function usePreTrialCallCheckMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ trial_id, ...body }: Vars) =>
      savePreTrialCallCheck(trial_id, body),
    onMutate: async (vars: Vars) => {
      await qc.cancelQueries({ queryKey: trialKeys.list() });
      const prev = qc.getQueryData<TrialsTodayResponse>(trialKeys.list());

      qc.setQueryData<TrialsTodayResponse>(trialKeys.list(), (old) =>
        old
          ? {
              trials: old.trials.map((t) =>
                t.trial_id === vars.trial_id
                  ? {
                      ...t,
                      pre_trial_call_checks: t.pre_trial_call_checks.map(
                        (v, i) => (i === vars.stage - 1 ? vars.checked : v),
                      ),
                    }
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
