"use client";

import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { computeStats } from "../lib/aggregate";
import { useTrials } from "../hooks/useTrials";
import { StatCards } from "./StatCards";
import { TrialDetailSheet } from "./TrialDetailSheet";
import { TrialsTable } from "./TrialsTable";

export function TrialsDashboard() {
  const { data: trials, isLoading, isError, error } = useTrials();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const stats = useMemo(
    () => (trials ? computeStats(trials) : null),
    [trials],
  );

  function openDetail(trialId: string) {
    setSelectedId(trialId);
    setSheetOpen(true);
  }

  return (
    // flex-1 + min-h-0: 남은 높이를 표 영역에 넘겨준다. min-h-0 이 없으면 flex 자식이
    // 콘텐츠 높이만큼 부풀어 내부 스크롤이 생기지 않는다.
    <main className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 flex-col px-8 py-10">
      <header className="mb-6 shrink-0">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Today&apos;s Trials
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sales 팀 내부용 · 오늘 진행되는 trial 현황
        </p>
      </header>

      <div className="shrink-0">
        <StatCards stats={stats} loading={isLoading} />
      </div>

      {/* 이 영역만 스크롤된다 → 헤더·KPI 는 항상 보이고, 표 헤더는 여기 기준 sticky */}
      <section className="mt-6 flex min-h-0 flex-1 flex-col">
        {isError ? (
          <div className="glass rounded-xl p-6 text-sm text-destructive">
            목록을 불러오지 못했습니다
            {error instanceof Error ? `: ${error.message}` : ""}
          </div>
        ) : isLoading ? (
          <div className="glass flex flex-col gap-3 rounded-xl p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !trials || trials.length === 0 ? (
          <div className="glass rounded-xl p-10 text-center text-sm text-muted-foreground">
            오늘 예정된 trial 이 없습니다
          </div>
        ) : (
          <TrialsTable trials={trials} onRowClick={openDetail} />
        )}
      </section>

      <TrialDetailSheet
        trialId={selectedId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </main>
  );
}
