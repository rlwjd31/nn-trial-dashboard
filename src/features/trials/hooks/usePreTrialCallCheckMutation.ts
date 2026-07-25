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
export function usePreTrialCallCheckMutation(scopeId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ trial_id, ...body }: Vars) =>
      savePreTrialCallCheck(trial_id, body),
    // 같은 scope 는 직렬 실행된다 — 한 체크박스를 연타했을 때 늦게 도착한 옛 값이
    // 최신 값을 덮어쓰지 않게 한다. 체크박스마다 다른 id 라 서로를 막지는 않는다.
    scope: scopeId ? { id: scopeId } : undefined,
    onMutate: async (vars: Vars) => {
      const prev = qc.getQueryData<TrialsTodayResponse>(trialKeys.list());

      // ① 캐시를 먼저 고친다 — await 앞에 두어야 클릭과 같은 tick 에 화면이 바뀐다.
      //    (cancelQueries 를 먼저 await 하면 진행 중 refetch 가 끝날 때까지 체크가 지연된다)
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

      // ② 진행 중이던 목록 refetch 를 취소한다 — 늦게 도착한 응답이 낙관값을 덮지 않게.
      await qc.cancelQueries({ queryKey: trialKeys.list() });

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
