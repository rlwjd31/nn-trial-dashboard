// CloudTalk 클릭 발신(ct+tel:) 유틸. 스펙: docs/cloudtalk-call-button.md
//
// - ct+tel: 은 E.164 형식만 안전하게 동작(+국가코드, 공백/하이픈 없음) → toE164 필수.
// - 발신(from) 번호는 env(NEXT_PUBLIC_CLOUDTALK_FROM). 브라우저에서 링크를 만들므로
//   NEXT_PUBLIC_ 필수(비밀 아님 — 고객에게 보이는 발신 표시 번호).

/** CloudTalk 발신자(from) 번호. 미설정 시 빈 문자열 → ?from 생략. */
export const CLOUDTALK_FROM = process.env.NEXT_PUBLIC_CLOUDTALK_FROM ?? "";

/**
 * 전화번호를 E.164(`+국가코드…`, 숫자만)로 정규화한다.
 * 예: "+82 10-2345-6789" → "+821023456789", "010-2345-6789" → "+821023456789"
 */
export function toE164(raw: string | undefined | null, defaultCountry: "KR" = "KR"): string {
  if (!raw) return "";
  const s = raw.trim();
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (s.startsWith("+")) return `+${digits}`; // 이미 국제 형식
  if (s.startsWith("00")) return `+${digits.replace(/^00/, "")}`; // 국제 접두
  if (digits.startsWith("0") && defaultCountry === "KR") {
    return `+82${digits.replace(/^0/, "")}`; // 국내(KR) 번호
  }
  return `+${digits}`; // 국가코드 판단 불가 → 그대로 (발신 실패 가능)
}

/**
 * ct+tel: 딥링크 생성. target 이 유효하지 않으면 null.
 * from 은 인자 > CLOUDTALK_FROM 순. 값이 있으면 ?from= 부착.
 */
export function buildCtTelHref(
  targetNumber: string,
  fromNumber?: string,
): string | null {
  const target = toE164(targetNumber);
  if (!target) return null;
  const from = toE164(fromNumber ?? CLOUDTALK_FROM);
  return from
    ? `ct+tel:${encodeURIComponent(target)}?from=${encodeURIComponent(from)}`
    : `ct+tel:${encodeURIComponent(target)}`;
}
