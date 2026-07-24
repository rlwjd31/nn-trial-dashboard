# 기능 스펙 — CloudTalk 클릭 발신 버튼 (`CloudTalkCallButton`)

> 상태: 구현 대기(스펙 확정). 배치 위치: `src/features/trials/components/TrialDetailSheet.tsx`
> 의 **Call queue 버튼 바로 위/아래**. 기존 PRD의 `call_queue_url` / "call queue 이동"을
> 이 방식으로 **대체**한다(PRD §6.3, §7.2 참조).

## 1. 목적
학생 전화번호 옆 버튼 클릭 → CloudTalk Phone 데스크톱 앱으로 해당 번호 자동 발신.
프론트엔드 단독 완결(백엔드/n8n 추가 불필요).

## 2. 메커니즘
- CloudTalk 전용 URL 스킴 **`ct+tel:`** 사용. 순수 `tel:` 과 다름 — 반드시 `ct+tel:`.
- OS가 `ct+tel:` 링크를 CloudTalk 데스크톱 앱으로 라우팅한다(브라우저 확장은 개입 안 함).
- 발신은 클라이언트(브라우저 + CloudTalk 앱)가 처리.

## 3. 전제 조건
- 사용자 PC에 CloudTalk Phone 데스크톱 앱 설치·로그인.
- (해당 시) CloudTalk 브라우저 확장 설치.
- 없으면 링크가 동작 안 할 수 있음 → §6 fallback.

## 4. ⚠️ 전화번호 형식 — 확정됨 (E.164 필수)
> CloudTalk 공식 문서 확인 결과: `ct+tel:` 은 **E.164** 형식만 안전하게 동작한다.
> `+국가코드 + 번호`, **공백·하이픈·괄호 없음**. 예: `+821023456789`.
> (참고: https://help.cloudtalk.io/en/articles/2964244-the-click-to-call-extension)

우리 데이터의 `student_phone_number` 는 `+82 10-2345-6789` 형태(공백·하이픈 포함)라
**E.164가 아니다** → **정규화 유틸을 컴포넌트 진입 전에 반드시 거친다.**

### 정규화 규칙 — `toE164(raw, defaultCountry = "KR")`
배치: `src/features/trials/lib/format.ts` (또는 `phone.ts`).
1. 앞뒤 공백 제거.
2. 숫자와 맨 앞 `+` 를 제외한 모든 문자(공백·`-`·`(`·`)`·`.`) 제거.
3. `+` 로 시작 → 그대로 사용(이미 국제 형식). 예: `+82 10-2345-6789` → `+821023456789`.
4. `00` 로 시작(국제 접두) → `+` 로 치환.
5. `0` 으로 시작(국내 번호, KR) → `+82` + 앞 `0` 제거. 예: `010-2345-6789` → `+821023456789`.
6. 그 외(국가코드 판단 불가) → 원본을 그대로 두되 발신 실패 가능 → §6 fallback.

## 5. 컴포넌트 스펙
- 이름: `CloudTalkCallButton` · React 함수형 · TypeScript.
- 배치: `src/features/trials/components/CloudTalkCallButton.tsx`.

### 발신(from) 번호 — 환경변수
- CloudTalk 발신 번호는 고정: `+82 234986970` (E.164: `+82234986970`).
- **환경변수로 관리**: `NEXT_PUBLIC_CLOUDTALK_FROM`.
  - ⚠ `ct+tel:` 링크는 **브라우저에서 생성**되므로 클라이언트에서 읽혀야 한다 →
    **`NEXT_PUBLIC_` 접두어 필수.**
  - 이 값은 **비밀이 아님**(고객에게 노출되는 발신자 표시 번호)이라 `NEXT_PUBLIC_` 이 안전하다.
    n8n 토큰/URL 같은 **서버 전용 비밀과는 구분**된다(PRD §3 — 그쪽은 절대 `NEXT_PUBLIC` 금지).
  - 접근 헬퍼: `src/features/trials/lib/cloudtalk.ts`
    → `export const CLOUDTALK_FROM = process.env.NEXT_PUBLIC_CLOUDTALK_FROM ?? "";`
- 따라서 호출부(상세 패널 등)는 **`targetNumber` 만** 넘긴다.

### Props
| prop | 타입 | 필수 | 설명 |
|---|---|---|---|
| `targetNumber` | `string` | O | 발신 대상(고객/학생) 번호. 컴포넌트 내부에서 `toE164` 적용 |
| `fromNumber` | `string` | X | 발신 번호 override(기본값 `CLOUDTALK_FROM`). 보통 생략 |

### href 생성 규칙
- `target = toE164(targetNumber)`, `from = toE164(fromNumber ?? CLOUDTALK_FROM)`.
- 각각 `encodeURIComponent` 로 인코딩.
- `from` 값이 있으면(= env 설정됨) **`?from=` 부착**, 없으면 생략:
  - `from` 있음: `ct+tel:{encTarget}?from={encFrom}`
  - `from` 없음: `ct+tel:{encTarget}`

### UI
- 버튼형 링크(`<a>`). shadcn `Button` 을 `render={<a … />}` 로 렌더(디자인 시스템 일관).
  Base UI 경고 방지 위해 **`nativeButton={false}`** 지정(앵커 렌더 시).
- 라벨: 전화 아이콘(lucide `PhoneIcon`) + `"전화 걸기"` 또는 `"{targetNumber}로 전화 걸기"`.
- 대시보드 글래스 톤에 맞춤(design.md §4).

## 6. 방어 / 예외
- `targetNumber` 없음/빈 값 → **비활성 버튼**("번호 없음") 렌더.
- `toE164` 가 유효 형식을 못 만들면 → 비활성 + 원본 번호 텍스트 노출(최소 fallback).
- 앱 미설치 사용자: MVP에서는 별도 감지 없음. 링크 옆에 번호 텍스트를 남겨 수기 발신 가능하게.

## 7. 통합 위치
- `TrialDetailSheet` 의 Call queue 버튼 **바로 위/아래**에 `<CloudTalkCallButton targetNumber={detail.student_phone_number} />`.
- (선택) 목록 행 Phone 셀에도 확장 가능(MVP는 상세 패널 우선).
- 기존 `call_queue_url` 기반 "Call queue 이동" 버튼을 대체하거나 병기.

## 8. 비목표
- CloudTalk 서버 API(click-to-call) 연동 → 제외(딥링크로 충분).
- 통화 상태/결과 수신·로그 저장 → 제외.
- 앱 미설치 감지 정교화 → MVP 이후.

## 9. 완료 기준
- [ ] `targetNumber` → E.164 정규화 후 `ct+tel:` 링크 생성.
- [ ] `fromNumber` 전달 시 `?from=` 인코딩 부착.
- [ ] `targetNumber` 없을 때 비활성 버튼.
- [ ] 값이 `encodeURIComponent` 로 인코딩됨.
- [ ] 앱 설치·로그인 환경에서 클릭 시 CloudTalk 발신 트리거.

## 10. 참조 구현 (기준 — TS/정규화/fallback 반영해 개선)
```tsx
// 발신 번호는 env(NEXT_PUBLIC_CLOUDTALK_FROM). ct+tel: 은 E.164 필수 → toE164 정규화.
const target = toE164(targetNumber);
const from = toE164(fromNumber ?? CLOUDTALK_FROM); // "" 이면 ?from 생략
const href = from
  ? `ct+tel:${encodeURIComponent(target)}?from=${encodeURIComponent(from)}`
  : `ct+tel:${encodeURIComponent(target)}`;
```
