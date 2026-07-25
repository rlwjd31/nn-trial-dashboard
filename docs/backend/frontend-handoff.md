# Frontend Handoff — Trials API 계약

> 이 문서 + [openapi.yaml](./openapi.yaml) 가 **프론트↔백엔드의 유일한 인터페이스(계약)** 다.
> 프론트(`main` 브랜치)는 이 계약만 보고 `src/**` 를 맞춘다. 백엔드(n8n cloud + `backend` 브랜치)와
> **코드 의존이 없다** — 오직 JSON 모양(계약)으로만 연결된다.

## 읽는 법 (브랜치 교차 없이)
프론트 세션(`~/workspace/naonow/trial-dashboard`, main)에서 아래 중 하나로 읽는다. **git 브랜치 전환 불필요**:
- 워크트리 폴더 직접 열기: `../trial-dashboard-backend/docs/backend/` (디스크에 실재하는 별도 폴더)
- 또는 `git show backend:docs/backend/openapi.yaml` / `git show backend:docs/backend/frontend-handoff.md`

## 계약 (현재 배포된 n8n 기준)
브라우저 호출 엔드포인트(프론트 자기 도메인 `/api/*` → n8n `/webhook/*` 프록시). 상세 스키마는 openapi.yaml.

| 프론트 | n8n | 메서드 |
|---|---|---|
| `/api/trials` | `/webhook/trials/today` | GET |
| `/api/trials/{id}` | `/webhook/trials/detail?trial_id=` | GET |
| `/api/trials/pre-trial-call-check` | `/webhook/trials/pre-trial-call-check` | PATCH |
| `/api/trials/note` | `/webhook/trials/note` | PATCH |

## 프론트 변경 체크리스트 (계약 반영)
1. **student_name 추가** — 목록/상세에 `student_name: string` 신규. TrialsTable "Student" 컬럼을 `#id` → **이름 표시**(보조로 #id).
2. **pre_trial_call_checks: boolean[]** — 기존 `precheck_1/2/3`(3 boolean) 제거, 단일 배열로.
   · `TrialsTable`: `checked={t.pre_trial_call_checks[stage-1]}` · `computeStats` remaining=`t.pre_trial_call_checks.every(v=>!v)` · type · mock.
3. **엔드포인트 rename** — `precheck` → `pre-trial-call-check`: `/api/trials/pre-trial-call-check`(PATCH). route handler 폴더 · api client(`savePrecheck`→`savePreTrialCallCheck`) · 훅. body `{trial_id, stage, checked}` 유지.
4. **KPI 카드 삭제** — `pre_call_done`·`post_call_done` 백엔드 제거됨 → StatCards "Pre-call done"·"Post-call done" 타일 + `computeStats` 해당 필드 삭제.
5. **sales_note(상세)** — 이미 응답에 있음. 상세 패널에 메모 표시 UI 추가(선택). 저자 표시는 없음(설계상 제외).
6. **base URL 확인** — n8n production URL이 `/webhook/<webhookId>/trials/...` 형태로 표시됨. 프론트 `N8N_BASE_URL`/프록시 경로가 실제 URL과 맞는지 활성화 후 확정.

## 계약 변경 프로토콜
응답/요청 모양을 바꿀 땐 **openapi.yaml 을 먼저 갱신**(계약이 SoT) → 백엔드 n8n 과 프론트 `src/**` 가 각자 그 모양으로 수렴. 스펙과 타입을 대조해 drift 를 잡는다.
