"use client";

import { CircleCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { TrialListItem } from "@/types/trial";
import { formatTrialTime, isCanceled, statusMeta, tierMeta } from "../lib/format";
import { PrecheckCheckbox } from "./PrecheckCheckbox";

interface Props {
  trials: TrialListItem[];
  onRowClick: (trialId: string) => void;
}

const STAGES = [1, 2, 3] as const;

export function TrialsTable({ trials, onRowClick }: Props) {
  return (
    <div
      className={cn(
        "glass overflow-hidden rounded-2xl",
        // 가독성용 여백: 셀 좌우/상하 + 헤더 높이 + 바깥쪽 거터
        "[&_th]:h-13 [&_th]:px-5 [&_td]:px-5 [&_td]:py-4",
        "[&_th:first-child]:pl-6 [&_td:first-child]:pl-6",
        "[&_th:last-child]:pr-6 [&_td:last-child]:pr-6",
      )}
    >
      <Table>
        <TableHeader className="[&_tr]:border-glass-edge-strong">
          <TableRow className="bg-white/5 hover:bg-white/5">
            <TableHead>Time</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Mentor</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Rep</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Purchased</TableHead>
            <TableHead className="text-center">Pre-trial 1·2·3</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trials.map((t) => {
            const canceled = isCanceled(t);
            const status = statusMeta(t.status);
            const tier = tierMeta(t.mentor_tier);
            return (
              <TableRow
                key={t.trial_id}
                onClick={() => onRowClick(t.trial_id)}
                className="cursor-pointer border-white/5 hover:bg-white/5"
              >
                <TableCell className="font-medium tabular-nums">
                  {formatTrialTime(t.trial_time)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  #{t.student_id}
                </TableCell>
                <TableCell className="max-w-[260px] truncate" title={t.student_email}>
                  {t.student_email}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {t.student_phone_number}
                </TableCell>
                <TableCell className="text-foreground">
                  {t.mentor_name}
                </TableCell>
                <TableCell>
                  <Badge className={tier.className}>{tier.label}</Badge>
                </TableCell>
                <TableCell className="text-foreground">
                  {t.sales_rep_name}
                </TableCell>
                <TableCell>
                  <Badge className={status.className}>{status.label}</Badge>
                </TableCell>
                <TableCell>
                  {t.converted ? (
                    <Badge className="border border-emerald-300/35 bg-emerald-400/20 text-emerald-50 backdrop-blur-sm">
                      <CircleCheckIcon />
                      Purchased
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-3">
                    {STAGES.map((stage) => (
                      <PrecheckCheckbox
                        key={stage}
                        trialId={t.trial_id}
                        stage={stage}
                        checked={t[`precheck_${stage}`]}
                        disabled={canceled}
                      />
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
