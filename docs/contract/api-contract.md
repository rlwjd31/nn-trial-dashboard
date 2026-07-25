# Frontend Handoff — Trials API 계약

> 이 문서 + [openapi.yaml](./openapi.yaml) 가 **프론트↔백엔드의 유일한 인터페이스(계약)** 다.
> 프론트(`frontend` 브랜치)는 이 계약만 보고 `src/**` 를 맞춘다. 백엔드(n8n cloud + `backend` 브랜치)와
> **코드 의존이 없다** — 오직 JSON 모양(계약)으로만 연결된다.

## 읽는 법 (브랜치 교차 없이)
계약 문서는 **`backend` 브랜치 소유**다. 프론트 세션에서 `git checkout` 없이 아래 중 하나로 읽는다:
- 워크트리 폴더 직접 열기: `../backend/docs/contract/` (디스크에 실재하는 별도 폴더)
- 또는 `git show backend:docs/contract/openapi.yaml` / `git show backend:docs/contract/api-contract.md`

## 계약 (현재 배포된 n8n 기준)
브라우저 호출 엔드포인트(프론트 자기 도메인 `/api/*` → n8n `/webhook/*` 프록시). 상세 스키마는 openapi.yaml.

| 프론트 | n8n | 메서드 |
|---|---|---|
| `/api/trials` | `/webhook/trials/today` | GET |
| `/api/trials/{id}` | `/webhook/trials/detail?trial_id=` | GET |
| `/api/trials/pre-trial-call-check` | `/webhook/trials/pre-trial-call-check` | PATCH |
| `/api/trials/note` | `/webhook/trials/note` | PATCH |

## 프론트 변경 체크리스트 (계약 반영)

`backend` 브랜치는 이미 이 계약에 맞춰져 있다(`pnpm test:contract` 통과). 아래는 **프론트 브랜치에 남은 일**이다.
실측 근거: `frontend` 워크트리 dev 서버(`:3000`)를 계약 러너로 대조한 결과.

1. **student_name 추가** — 목록/상세에 `student_name: string` 신규. TrialsTable "Student" 컬럼을 `#id` → **이름 표시**(보조로 #id).
2. **pre_trial_call_checks: boolean[]** — 기존 `precheck_1/2/3`(3 boolean) 제거, 길이 3 배열로.
   · `TrialsTable`: `checked={t.pre_trial_call_checks[stage-1]}` · `computeStats` remaining=`t.pre_trial_call_checks.every(v=>!v)` · type · mock.
3. **엔드포인트 rename** — `precheck` → `pre-trial-call-check`: route handler 폴더 ·
   api client(`savePrecheck` → `savePreTrialCallCheck`) · 훅. body `{trial_id, stage, checked}` 유지.
4. **KPI 카드 삭제** — `pre_call_done`·`post_call_done` 백엔드 제거됨 → StatCards 두 타일 + `computeStats` 해당 필드 삭제.
5. **`call_queue_url` 제거** — 상세 응답에서 삭제됨(CloudTalk `ct+tel:` 전환). 스펙에도 더는 없다.
6. **`sales_note` 는 필수 필드** — 상세 응답에 항상 존재하며 미기록이면 `null`.
7. **enum 값 정정** — `mentor_tier` 는 `elite|normal`(**`basic` 없음**), trial `status` 는
   `approved|canceled|completed|paid`(**`scheduled` 없음**), `mentor_gender` 는 `female|male|nonbinary`.
   mock 시드에 남은 `basic`/`scheduled` 를 교체할 것.
8. **노트 기능 코드 인계** — `useNoteMutation.ts`(react-query optimistic update)는 backend 브랜치에만 있던 파일로,
   `frontend` 워크트리 `src/features/trials/hooks/useNoteMutation.ts` 에 **미커밋 상태로 복사해 두었다.**
   `lib/api.ts` 의 `saveNote` 도 함께 필요하다(frontend 사본에는 없음).
   현재 `NotesEditor` 는 localStorage 임시 저장이므로, n8n note 엔드포인트로 교체할 때 이 둘을 쓰면 된다.
9. **base URL 확인** — n8n production URL 이 `/webhook/<webhookId>/trials/...` 형태로 표시된다.
   프론트 `N8N_BASE_URL`/프록시 경로가 실제 URL 과 맞는지 **워크플로우 발행 후** 확정.

## 검증 방법
백엔드 브랜치의 러너로 어느 쪽 응답이든 스펙과 대조할 수 있다(의존성 0, 서버 없이도 mock 검증 가능):

```bash
# backend 워크트리에서
pnpm test:contract                                              # mock 대조
node test/contract-check.mts --base http://localhost:3000/api    # 프론트 dev 서버 대조
```

## 계약 변경 프로토콜
응답/요청 모양을 바꿀 땐 **openapi.yaml 을 먼저 갱신**(계약이 SoT) → 백엔드 n8n 과 프론트 `src/**` 가
각자 그 모양으로 수렴. 러너로 대조해 drift 를 잡는다.
