"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTrialDetail } from "@/lib/api";
import { trialKeys } from "./queryKeys";

/** 단건 상세. trialId 가 있을 때(패널 열림)만 조회한다. */
export function useTrialDetail(trialId: string | null) {
  return useQuery({
    queryKey: trialKeys.detail(trialId ?? ""),
    queryFn: () => fetchTrialDetail(trialId as string),
    enabled: !!trialId,
  });
}
