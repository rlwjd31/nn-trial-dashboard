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
import { PreTrialCallCheckbox } from "./PreTrialCallCheckbox";

interface Props {
  trials: TrialListItem[];
  onRowClick: (trialId: string) => void;
}

const STAGES = [1, 2, 3] as const;

export function TrialsTable({ trials, onRowClick }: Props) {
  return (
    <div
      className={cn(
        "glass rounded-lg",
        // 스크롤 컨테이너는 **이 div** 다. thead sticky 가 여기 기준으로 붙는다.
        // (overflow-auto 도 border-radius 로 클리핑하므로 overflow-hidden 은 필요 없다)
        "h-full overflow-auto",
        // ⚠ 이 표면만 backdrop-filter 를 끈다. backdrop-filter 를 가진 요소는
        // **backdrop root** 가 되어, 그 안의 th 가 blur 할 대상에서 "컨테이너 내부 행" 이 빠진다
        // → 헤더 blur 가 아예 먹지 않는다. 뒷배경이 매끄러운 그라디언트라 여기 blur 는
        //   시각적 기여가 거의 없으므로, 헤더 blur 를 살리는 쪽을 택했다.
        "[backdrop-filter:none]",
        // shadcn Table 내부 래퍼의 overflow-x-auto 를 무력화한다 — 그대로 두면 그쪽이
        // 가장 가까운 스크롤 컨테이너가 되어 sticky 가 먹지 않는다. 가로 스크롤은 이 div 가 담당.
        "[&>[data-slot=table-container]]:overflow-visible",
        // 가독성용 여백: 셀 좌우/상하 + 헤더 높이 + 바깥쪽 거터
        "[&_th]:h-13 [&_th]:px-5 [&_td]:px-5 [&_td]:py-4",
        "[&_th:first-child]:pl-6 [&_td:first-child]:pl-6",
        "[&_th:last-child]:pr-6 [&_td:last-child]:pr-6",
      )}
    >
      <Table>
        {/* 컬럼 헤더 고정.
            · 배경은 tr 이 아니라 th 에 준다 — sticky 로 움직이는 주체가 th 이고
              tr 배경은 따라오지 않아 행이 그대로 비친다.
            · 색은 유리 톤(bg-glass-strong) 유지 + **강한 backdrop blur** 로 아래를 지나가는
              행을 녹인다. 이게 동작하려면 위 컨테이너의 backdrop-filter 가 꺼져 있어야 한다. */}
        <TableHeader
          className={cn(
            "[&_tr]:border-glass-edge-strong",
            "[&_th]:sticky [&_th]:top-0 [&_th]:z-10",
            "[&_th]:bg-glass-strong",
            "[&_th]:[backdrop-filter:blur(48px)_saturate(180%)]",
          )}
        >
          <TableRow className="hover:bg-transparent">
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
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {t.student_name}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      #{t.student_id}
                    </span>
                  </div>
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
                      <PreTrialCallCheckbox
                        key={stage}
                        trialId={t.trial_id}
                        stage={stage}
                        checked={t.pre_trial_call_checks[stage - 1] ?? false}
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
