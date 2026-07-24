"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { saveNote } from "@/lib/api";
import type { NoteRequest, TrialDetail } from "@/types/trial";
import { trialKeys } from "./queryKeys";

/**
 * 학생 추가정보(세일즈 메모) 저장 — Optimistic Update.
 * 상세 캐시(trialKeys.detail)를 먼저 수정하고, 실패 시 롤백 + 토스트.
 * 목록에는 노트를 노출하지 않으므로 detail 캐시만 다룬다.
 */
export function useNoteMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: saveNote,
    onMutate: async (vars: NoteRequest) => {
      const key = trialKeys.detail(vars.trial_id);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TrialDetail>(key);

      qc.setQueryData<TrialDetail>(key, (old) =>
        old ? { ...old, sales_note: vars.note } : old,
      );

      return { prev, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
      toast.error("메모 저장 실패 — 이전 상태로 되돌렸습니다", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}
