"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { TrialStats } from "../lib/aggregate";

interface Props {
  stats: TrialStats | null;
  loading?: boolean;
}

interface Tile {
  key: keyof TrialStats;
  label: string;
  hint?: string;
}

// PRD §6.1 상단 KPI 카드 (Converted 는 nice-to-have).
const TILES: Tile[] = [
  { key: "total", label: "Today's trials", hint: "취소 제외" },
  { key: "remaining", label: "Remaining", hint: "체크 0개" },
  { key: "preCallDone", label: "Pre-call done" },
  { key: "postCallDone", label: "Post-call done" },
  { key: "converted", label: "Converted today" },
];

export function StatCards({ stats, loading }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {TILES.map((tile) => (
        <div
          key={tile.key}
          className="glass flex flex-col gap-1 rounded-2xl px-4 py-4"
        >
          <p className="text-xs font-medium text-muted-foreground">
            {tile.label}
          </p>
          {loading || !stats ? (
            <Skeleton className="mt-1 h-9 w-12" />
          ) : (
            <p className="font-heading text-4xl font-semibold tabular-nums text-foreground">
              {stats[tile.key]}
            </p>
          )}
          {tile.hint && (
            <p className="text-[11px] text-muted-foreground/70">{tile.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}
