"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { PreTrialCallStage } from "@/types/trial";
import { usePreTrialCallCheckMutation } from "../hooks/usePreTrialCallCheckMutation";

interface Props {
  trialId: string;
  stage: PreTrialCallStage;
  checked: boolean;
  disabled?: boolean;
}

/**
 * 목록 행의 Pre-trial call 체크박스. 클릭 시 optimistic 저장.
 * mutate 인자는 `{ trial_id, stage, checked }` 그대로 — 훅이 trial_id 를 경로로 옮긴다.
 */
export function PreTrialCallCheckbox({
  trialId,
  stage,
  checked,
  disabled,
}: Props) {
  const mutation = usePreTrialCallCheckMutation();

  return (
    // 행 클릭(상세 열기)과 분리 — 체크 영역 클릭은 버블링 막는다.
    <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
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
