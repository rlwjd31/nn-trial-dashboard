"use client";

import { ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrialDetail } from "@/types/trial";
import { useTrialDetail } from "../hooks/useTrialDetail";

interface Props {
  trialId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

function DetailBody({ detail }: { detail: TrialDetail }) {
  return (
    <dl className="flex flex-col gap-3">
      <Field label="Student ID" value={`#${detail.student_id}`} />
      <Field label="Email" value={detail.student_email} />
      <Field label="Phone" value={detail.student_phone_number} />
      <Field label="Level" value={detail.level} />
      <Separator />
      <Field label="Mentor" value={`${detail.mentor_name} (#${detail.mentor_id})`} />
      <Field label="Gender" value={detail.mentor_gender} />
      <Separator />
      <Field
        label="Interests"
        value={
          detail.interests.length ? (
            <span className="flex flex-wrap gap-1">
              {detail.interests.map((i) => (
                <Badge key={i} variant="secondary">
                  {i}
                </Badge>
              ))}
            </span>
          ) : (
            "—"
          )
        }
      />
      <Field label="Trial date" value={detail.trial_date} />
    </dl>
  );
}

export function TrialDetailSheet({ trialId, open, onOpenChange }: Props) {
  const { data: detail, isLoading, isError, error } = useTrialDetail(
    open ? trialId : null,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="glass-strong w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Trial 상세</SheetTitle>
          <SheetDescription>
            {trialId ? `Trial #${trialId}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isLoading && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          )}
          {isError && (
            <p className="text-sm text-destructive">
              상세를 불러오지 못했습니다
              {error instanceof Error ? `: ${error.message}` : ""}
            </p>
          )}
          {detail && <DetailBody detail={detail} />}
        </div>

        <div className="border-t border-glass-edge p-4">
          <Button
            className="w-full"
            disabled={!detail?.call_queue_url}
            render={
              detail?.call_queue_url ? (
                <a
                  href={detail.call_queue_url}
                  target="_blank"
                  rel="noreferrer"
                />
              ) : undefined
            }
          >
            <ExternalLinkIcon />
            Call queue 이동
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
