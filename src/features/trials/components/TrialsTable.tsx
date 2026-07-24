"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <div className="glass overflow-hidden rounded-2xl">
      <Table>
        <TableHeader className="[&_tr]:border-glass-edge-strong">
          <TableRow className="bg-white/5 hover:bg-white/5">
            <TableHead>Time</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Mentor</TableHead>
            <TableHead>Status</TableHead>
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
                <TableCell className="max-w-[180px] truncate" title={t.student_email}>
                  {t.student_email}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {t.student_phone_number}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    {t.mentor_name}
                    <Badge variant={tier.variant}>{tier.label}</Badge>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
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
