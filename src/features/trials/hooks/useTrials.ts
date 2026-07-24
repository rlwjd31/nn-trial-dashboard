"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTrialsToday } from "@/lib/api";
import { trialKeys } from "./queryKeys";

/**
 * 오늘의 trial 목록.
 * staleTime/refetchOnWindowFocus 는 Providers 전역 기본값(PRD §5)을 따른다.
 */
export function useTrials() {
  return useQuery({
    queryKey: trialKeys.list(),
    queryFn: fetchTrialsToday,
    select: (data) => data.trials,
  });
}
