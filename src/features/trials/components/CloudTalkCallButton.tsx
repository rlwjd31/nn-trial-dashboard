"use client";

import { PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildCtTelHref } from "../lib/cloudtalk";

interface Props {
  /** 발신 대상(고객/학생) 번호. 내부에서 E.164 정규화. */
  targetNumber?: string;
  /** 발신 번호 override. 기본값은 CLOUDTALK_FROM(env). 보통 생략. */
  fromNumber?: string;
  className?: string;
}

/**
 * CloudTalk 클릭 발신 버튼. 클릭 시 ct+tel: 딥링크로 CloudTalk 데스크톱 앱 발신.
 * 스펙: ../docs/cloudtalk-call-button.md
 */
export function CloudTalkCallButton({
  targetNumber,
  fromNumber,
  className,
}: Props) {
  const href = targetNumber ? buildCtTelHref(targetNumber, fromNumber) : null;

  if (!href) {
    return (
      <Button className={className} variant="outline" disabled>
        <PhoneIcon /> 번호 없음
      </Button>
    );
  }

  return (
    <Button
      className={className}
      nativeButton={false}
      render={<a href={href} />}
    >
      <PhoneIcon /> {targetNumber}로 전화 걸기
    </Button>
  );
}
