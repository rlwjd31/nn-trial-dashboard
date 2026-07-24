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
    <main className="mx-auto w-full max-w-[1680px] px-8 py-10">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Today&apos;s Trials
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sales 팀 내부용 · 오늘 진행되는 trial 현황
        </p>
      </header>

      <StatCards stats={stats} loading={isLoading} />

      <section className="mt-6">
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
