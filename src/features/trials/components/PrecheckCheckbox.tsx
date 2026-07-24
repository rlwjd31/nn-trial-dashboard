"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { PrecheckStage } from "@/types/trial";
import { usePrecheckMutation } from "../hooks/usePrecheckMutation";

interface Props {
  trialId: string;
  stage: PrecheckStage;
  checked: boolean;
  disabled?: boolean;
}

/** 목록 행의 Pre-trial 체크박스. 클릭 시 optimistic 저장(usePrecheckMutation). */
export function PrecheckCheckbox({ trialId, stage, checked, disabled }: Props) {
  const mutation = usePrecheckMutation();

  return (
    // 행 클릭(상세 열기)과 분리 — 체크 영역 클릭은 버블링 막는다.
    <span
      className="inline-flex"
      onClick={(e) => e.stopPropagation()}
    >
      <Checkbox
        checked={checked}
        disabled={disabled || mutation.isPending}
        onCheckedChange={(next) =>
          mutation.mutate({ trial_id: trialId, stage, checked: next })
        }
        aria-label={`Pre-trial ${stage}`}
      />
    </span>
  );
}
