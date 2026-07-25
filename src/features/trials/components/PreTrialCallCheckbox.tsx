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
 *
 * ⚠ 저장 중(`isPending`)에 `disabled` 를 걸지 않는다. n8n 왕복이 ~0.7s 라
 * 그 동안 클릭이 버려져 "먹통" 으로 느껴진다. 화면은 optimistic 값이 이미 정답이고,
 * 실패하면 훅이 롤백 + 토스트로 알린다. 연타 순서는 scope 로 직렬화해 지킨다.
 */
export function PreTrialCallCheckbox({
  trialId,
  stage,
  checked,
  disabled,
}: Props) {
  const mutation = usePreTrialCallCheckMutation(
    `pre-trial-call-check:${trialId}:${stage}`,
  );

  return (
    // 행 클릭(상세 열기)과 분리 — 체크 영역 클릭은 버블링 막는다.
    <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) =>
          mutation.mutate({ trial_id: trialId, stage, checked: next })
        }
        aria-label={`Pre-trial ${stage}`}
      />
    </span>
  );
}
