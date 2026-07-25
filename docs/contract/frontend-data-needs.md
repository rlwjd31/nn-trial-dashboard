# Frontend Data Needs — Today-Trials Dashboard

> 목적: **프론트가 실제로 소비하는 데이터를 100% 열거**하고, 그로부터 필요한 API
> endpoint와 각 필드의 출처를 역산한다. (계약을 UI 실사용에서 도출 — 추측 금지)
> 근거: `src/features/trials/**` 컴포넌트·훅·집계 코드 실측 (backend 브랜치 기준).
> 데이터 출처/쿼리는 [data-layer.md](../backend/data-layer.md), 명세는 [openapi.yaml](./openapi.yaml).

---

## 1. 화면 → 데이터 매핑 (실측)

### 1.1 목록 표 `TrialsTable` — 소비: `TrialListItem`
| 표 컬럼 | 필드 | 가공 |
|---|---|---|
| Time | `trial_time` | `formatTrialTime` → KST `HH:mm` |
| Student | `student_name` (+ `student_id`) | 이름 표시(보조로 #id). ⚠ 현재 프론트는 #id만 → 이름 표시로 수정 필요 |
| Email | `student_email` | truncate |
| Phone | `student_phone_number` | 그대로 |
| Mentor | `mentor_name` | 그대로 |
| Tier | `mentor_tier` | `tierMeta` (elite=Elite / basic=Basic 칩) |
| Rep | `sales_rep_name` | 그대로 |
| Status | `status` | `statusMeta` (approved→Completed / scheduled→Scheduled / canceled→Canceled) |
| Purchased | `converted` | true → "Purchased" 배지 |
| Pre-trial 1·2·3 | `precheck_1/2/3` | 체크박스(취소 행은 disabled) |

### 1.2 상단 KPI 카드 `StatCards` — 소비: `TrialListItem[]` 집계(`computeStats`)
카드 수치는 **별도 API 없이 목록 데이터로 프론트에서 계산**(PRD §6.1). 계산식:
| 카드 | 정의 | 사용 필드 |
|---|---|---|
| Today's trials (`total`) | 취소 제외 건수 | `status` |
| Remaining (`remaining`) | 미취소 **AND** `precheck_1/2/3` 모두 false | `status`, `precheck_1/2/3` |
| Pre-call done (`preCallDone`) | `pre_call_done=true` 수 | `pre_call_done` |
| Post-call done (`postCallDone`) | `post_call_done=true` 수 | `post_call_done` |
| Converted today (`converted`) | `converted=true` 수 | `converted` |
| (내부 `canceled`) | 취소 건수 | `status` |

> ⇒ `pre_call_done`·`post_call_done` 는 **행에는 안 보이지만 카드 집계에 필수** → 목록 응답에 반드시 포함.
> ⇒ "몇 번 pre-trial 했는지" = `precheck_1/2/3` 중 true 개수(0~3). Remaining 은 그게 0인 건.

### 1.3 상세 패널 `TrialDetailSheet` — 소비: `TrialDetail`
| 표시 | 필드 |
|---|---|
| Name / Student ID / Email / Phone / Level | `student_name` `student_id` `student_email` `student_phone_number` `level` |
| Mentor / Gender | `mentor_name` `mentor_id` `mentor_gender` |
| Interests | `interests[]` (칩 나열, 빈 배열이면 "—") |
| Trial date | `trial_date` |
| 발신 버튼 | 커밋본: `call_queue_url` / **개정 PRD: CloudTalk `ct+tel:` + `student_phone_number`** (→ `call_queue_url` 폐기) |
| 학생 추가정보(신규) | `sales_note` — 표시 UI는 후속(현재 백엔드/타입만) |

---

## 2. 필요한 API Endpoint (프론트가 호출하는 자기 도메인 `/api/*`)

| Endpoint | 메서드 | 용도 | 프론트 호출 지점 |
|---|---|---|---|
| `/api/trials` | GET | 오늘 목록 (표 + 카드 집계 소스) | `useTrials` → `fetchTrialsToday` |
| `/api/trials/{id}` | GET | 단건 상세 (패널) | `useTrialDetail` → `fetchTrialDetail` |
| `/api/trials/precheck` | PATCH | pre-trial 체크 저장 | `usePrecheckMutation` → `savePrecheck` |
| `/api/trials/note` | PATCH | 학생 추가정보 저장(신규) | `useNoteMutation` → `saveNote` |

- **집계 전용 API 없음** (카드는 목록으로 계산) → endpoint 4개면 충분.
- 각 `/api/*` 는 서버 Route Handler가 n8n `/webhook/*` 로 1:1 프록시(x-api-key 부착, `no-store`). 매핑:
  `/api/trials`→`/webhook/trials`, `/api/trials/{id}`→`/webhook/<hookId>/trials/<id>`,
  `/api/trials/precheck`→`/webhook/trials/precheck`, `/api/trials/note`→`/webhook/trials/note`.

---

## 3. "어떻게 가져오고 / 어떻게 내려주나" (데이터 흐름)

**읽기 (목록·상세)**
1. 브라우저 `useQuery` → `/api/*` (fetch, `no-store`).
2. Route Handler → n8n webhook → Postgres(§ 쿼리는 data-layer.md).
3. 응답 JSON을 **가공 없이** 그대로 반환(민감정보 필터 필요 시 Handler에서). 프론트가 포맷/집계.
4. 캐시: `staleTime 60s` + `refetchOnWindowFocus`(PRD §5). 목록은 `select`로 `trials`만 추출.

**쓰기 (precheck·note) — Optimistic**
1. mutation `onMutate`에서 해당 캐시 즉시 수정(precheck→목록 캐시, note→상세 캐시) + 스냅샷.
2. 서버 성공 시 그대로 유지(재조회 안 함 → n8n 호출 억제). 실패 시 스냅샷 롤백 + `sonner` 토스트.

---

## 4. 계약 확정 (frontend 실사용 기준 최소 필드)
- **목록 `TrialListItem`**: 위 1.1 필드 + `pre_trial_call_checks: boolean[]`(길이 3) + `converted`.
  ⚠ **스코프/명명 변경 → 프론트 코드 수정 필요**:
  - `precheck_1/2/3`(3개 boolean) → **`pre_trial_call_checks: boolean[]`** 단일 배열(예 `[false,true,false]`).
    · type `TrialListItem` · `TrialsTable`(`checked={t.pre_trial_call_checks[stage-1]}`) · `computeStats`(remaining=`t.pre_trial_call_checks.every(v=>!v)`) · mock.
  - 쓰기 엔드포인트 `precheck` → **`pre-trial-call-check`**: `/api/trials/pre-trial-call-check`(PATCH), n8n `/webhook/trials/pre-trial-call-check`.
    · route handler 폴더 · api client(`savePrecheck`→`savePreTrialCall`) · 훅. body 는 `{trial_id, stage, checked}` 유지.
  - `pre_call_done`·`post_call_done` 제거(구현 불요) → §1.2 "Pre-call done"·"Post-call done" 타일 **삭제**(computeStats·StatCards).
- **상세 `TrialDetail`**: 1.3 필드. `sales_note?` 추가. `call_queue_url`은 CloudTalk 전환 시 제거(현재는 병합 충돌 방지로 유지).
- **쓰기**: `PrecheckRequest{trial_id,stage(1|2|3),checked}` / `NoteRequest{trial_id,note}`.
- 상세 필드는 **개인정보(email/phone)** 포함 → URL 토큰 게이트(PRD §1) 뒤에서만 노출.
