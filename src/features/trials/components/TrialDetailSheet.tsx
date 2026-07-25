"use client";

import { useRef, useState } from "react";
import { ExternalLinkIcon, SquarePenIcon } from "lucide-react";
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
import { CHIP_NEUTRAL } from "../lib/format";
import { useTrialDetail } from "../hooks/useTrialDetail";
import { CloudTalkCallButton } from "./CloudTalkCallButton";
import { NotesEditor } from "./NotesEditor";

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
      <Field label="Name" value={detail.student_name} />
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
                <Badge key={i} className={CHIP_NEUTRAL}>
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

  // 시트 폭을 왼쪽 가장자리 핸들로 드래그해 조절.
  const [width, setWidth] = useState(640);
  const draggingRef = useRef(false);

  function handleResizeStart(e: React.PointerEvent) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.userSelect = "none";
    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      const next = window.innerWidth - ev.clientX; // 오른쪽 시트 → 왼쪽으로 끌면 넓어짐
      setWidth(Math.min(Math.max(next, 380), window.innerWidth * 0.95));
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="glass-strong bg-glass-strong! gap-0 overflow-hidden rounded-l-2xl border-l border-glass-edge-strong"
        style={{ width, maxWidth: "95vw" }}
      >
        {/* 폭 조절 드래그 핸들 (왼쪽 가장자리) */}
        <div
          onPointerDown={handleResizeStart}
          className="absolute inset-y-0 left-0 z-50 w-1.5 cursor-col-resize transition-colors hover:bg-white/25"
          aria-hidden
        />
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
          {/* key: trial 전환 시 에디터를 재마운트해 해당 trial 의 메모로 초기화 */}
          {detail && (
            <NotesEditor
              key={detail.trial_id}
              trialId={detail.trial_id}
              note={detail.sales_note}
            />
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-glass-edge p-4">
          {/* CloudTalk 클릭 발신 (ct+tel:) — 해당 학생 번호로 발신 */}
          <CloudTalkCallButton
            targetNumber={detail?.student_phone_number}
            className="w-full"
          />

          {/* 학생 관리 admin panel — 로그인·Reschedule·학생 메타 정보 수정 */}
          <Button
            variant="outline"
            className="w-full"
            disabled={!detail}
            nativeButton={!detail}
            render={
              detail ? (
                <a
                  href={`https://admin.naonow.com/students/${detail.student_id}/edit`}
                  target="_blank"
                  rel="noreferrer"
                />
              ) : undefined
            }
          >
            <SquarePenIcon />
            학생 관리 · 일정 변경
          </Button>

          {/* Call queue 이동 — 마지막 path 는 student_id */}
          <Button
            variant="outline"
            className="w-full"
            disabled={!detail}
            nativeButton={!detail}
            render={
              detail ? (
                <a
                  href={`https://admin.naonow.com/call-queue/${detail.student_id}`}
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
