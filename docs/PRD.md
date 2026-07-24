# PRD — Sales Today-Trials Dashboard (MVP)

## 0. 문서 목적
Sales팀 내부용 "오늘의 Trial" 대시보드. naonow-bi의 sales_today_trials 화면을
벤치마킹하되, 명시된 최소 기능만 구현한다. 본 문서는 Claude가 프론트/백엔드
구현 시 그대로 참조할 수 있도록 API 스펙과 화면 스펙을 포함한다.

### 벤치마킹 대상
- URL: https://naonow-bi.vercel.app/sales_today_trials
- 이 사이트는 **기능/정보구조 참조용**일 뿐이다. 어떤 데이터를 어떤 흐름으로
  보여주는지만 참고하며, **디자인(레이아웃·색·컴포넌트 스타일)은 베끼지 않는다.**
- 위 화면의 모든 기능을 복제하지 않는다. 본 PRD에 명시된 최소 기능(§2 목표,
  §6 화면 스펙)만 구현하고, 벤치마킹 화면에 있더라도 §2 비목표에 해당하는
  기능은 구현하지 않는다.
- 디자인 방향은 §6.0 을 따른다.

## 1. 배경 / 제약
- DB(GCP Cloud SQL, Postgres)에 프론트가 직접 붙을 수 없음.
- n8n의 고정 IP만 DB 방화벽에 화이트리스트됨 → n8n을 백엔드 API로 사용.
- 사용자: Sales팀 3명, Slack 내부 공유, URL 비공개.
- 학생 개인정보(email, phone) 포함 → 최소한의 인증 필요.

## 2. 목표 / 비목표
### 목표
- 오늘 진행되는 trial 목록과 진행 현황을 한 화면에서 파악.
- pre-trial 체크(1·2·3차)를 클릭해 DB에 저장.
- 행 클릭 시 상세 정보 확인 + call queue로 이동.

### 비목표 (Over-engineering 방지 — 명시적 제외)
- 로그인/계정 시스템, 권한 관리 → 제외 (토큰 1겹으로 대체).
- 사용자 간 실시간 동기화(웹소켓/폴링) → 제외. 본인 조작만 즉시 반영.
- 무한스크롤/페이지네이션 → 제외 (오늘 데이터라 양이 적음).
- 정렬/필터/검색 UI → 제외 (MVP 이후).
- 모바일 최적화 → 제외 (데스크톱 내부 도구).

## 3. 아키텍처
```
브라우저(Next.js Client)
   │  fetch (동일 도메인 /api/*)
   ▼
Vercel Route Handler (서버)  ← 토큰 + n8n URL 은닉
   │  header: x-api-key
   ▼
n8n Webhook (고정 IP)
   │
   ▼
GCP Cloud SQL (Postgres)
```
- 토큰(`N8N_API_TOKEN`)과 n8n URL(`N8N_BASE_URL`)은 `NEXT_PUBLIC_` 없이
  서버 전용 환경변수로 관리. 브라우저에 절대 노출 안 됨.

## 4. 기술 스택
| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js (App Router) | Route Handler로 서버 레이어 |
| 언어 | TypeScript | |
| 스타일 | Tailwind CSS | |
| 서버 상태 | TanStack Query | 캐싱 + optimistic update |
| 테이블 | 순수 HTML table | 규모 작음, 라이브러리 불필요 |
| 배포 | Vercel | |
| 백엔드 | n8n (Webhook 워크플로우) | |

## 5. 캐시 / 최신성 전략
- 목록 조회: TanStack Query `staleTime` 60초, `refetchOnWindowFocus: true`
  (창 복귀 시 최신화 → semi-real-time 체감).
- Vercel Route Handler: 목록 GET은 캐시하지 않음(`no-store`).
  이유: 체크박스 쓰기 직후 값이 반영돼야 하므로 서버 캐시가 방해됨.
- 체크박스 저장: **Optimistic Update**. 서버 응답 전 캐시를 즉시 수정,
  실패 시 롤백. → 본인 조작은 즉각 반영, n8n 재조회 호출 없음.

## 6. 화면 스펙

### 6.0 디자인 방향
벤치마킹 사이트의 디자인은 따르지 않는다. 아래 방향으로 **새로** 디자인한다.
- **컨셉**: Modern + Glassmorphism (반투명 유리 질감).
- **테마**: 다크 기본. 어두운 gradient 배경 위에 반투명 글래스 표면을 얹는다.
  (라이트/토글은 MVP 비목표 — 필요 시 이후 확장.)
- **글래스 표면**: 카드/상세 패널/헤더 등 주요 표면에 반투명 배경
  (`background`에 낮은 alpha) + `backdrop-blur` + 얇은 반투명 border +
  부드러운 그림자. Tailwind 예: `bg-white/10 backdrop-blur-md border
  border-white/20 shadow-lg rounded-2xl` (톤은 배경에 맞춰 조정).
- **배경**: 은은한 gradient 또는 컬러 blob 위에 글래스 표면을 얹어
  블러 효과가 드러나게 한다. 단색 흰 배경은 지양.
- **깊이감**: rounded corner(넉넉하게), 계층별 blur/opacity 차등, 소프트 섀도우.
- **타이포/여백**: 넉넉한 여백, 명확한 위계, 읽기 쉬운 대비 확보.
- **접근성**: 반투명 위 텍스트 대비(WCAG AA) 유지. 블러 뒤 콘텐츠 때문에
  가독성이 떨어지지 않도록 표면 alpha/대비를 조정한다.
- **제약**: 화려함보다 정보 파악 속도가 우선인 내부 도구임을 잊지 않는다.
  글래스 효과는 표면 강조에만 쓰고, 데이터 밀도/가독성을 해치지 않는다.

### 6.1 대시보드 (상단 카드)
- Today's trials (오늘 trial 총 수)
- Pre-call done (pre-call 완료 수)
- Post-call done (post-call 완료 수)
- Converted today (있으면 표시, nice-to-have)
※ 카드 수치는 목록 데이터로 프론트에서 집계 (별도 API 불필요).

### 6.2 목록 (테이블 행)
| 컬럼 | 필드 | 비고 |
|---|---|---|
| Trial time | trial_time | |
| Student ID | student_id | |
| Email | student_email | |
| Phone | student_phone_number | |
| Mentor | mentor_name + tier | tier = elite / basic |
| Status | status | |
| Pre-trial 1·2·3 | precheck_1/2/3 | 클릭 저장 체크박스 |

### 6.3 상세 패널 (행 클릭 시)
- student_id, email, phone_number
- level
- mentor_id, mentor_name, mentor_gender
- interests
- trial_date
- [Call queue 이동] 버튼

## 7. n8n API 스펙 (필수)
공통: 요청 헤더 `x-api-key: <token>` 필수. 불일치 시 401.
공통 응답: JSON. 실패 시 `{ "error": string }`.

### 7.1 오늘 Trial 목록
- **GET** `/webhook/trials/today`
- Query: 없음 (서버가 KST 기준 오늘로 필터)
- 200 응답:
```json
{
  "trials": [
    {
      "trial_id": "string",
      "trial_time": "2026-07-24T14:00:00+09:00",
      "student_id": "string",
      "student_email": "string",
      "student_phone_number": "string",
      "mentor_name": "string",
      "mentor_tier": "elite | basic",
      "status": "string",
      "precheck_1": false,
      "precheck_2": false,
      "precheck_3": false,
      "pre_call_done": false,
      "post_call_done": false,
      "converted": false
    }
  ]
}
```

### 7.2 Trial 상세
- **GET** `/webhook/trials/detail?trial_id=<id>`
- 200 응답:
```json
{
  "trial_id": "string",
  "student_id": "string",
  "student_email": "string",
  "student_phone_number": "string",
  "level": "string",
  "mentor_id": "string",
  "mentor_name": "string",
  "mentor_gender": "string",
  "interests": ["string"],
  "trial_date": "2026-07-24",
  "call_queue_url": "string"
}
```

### 7.3 Pre-trial 체크 저장
- **PATCH** `/webhook/trials/precheck`
- Body:
```json
{ "trial_id": "string", "stage": 1, "checked": true }
```
  (stage: 1 | 2 | 3)
- 200 응답:
```json
{ "ok": true, "trial_id": "string", "stage": 1, "checked": true }
```

## 8. 프론트 Route Handler 스펙 (Claude 구현 참조용)
브라우저는 아래 자기 도메인 엔드포인트만 호출. 각 핸들러가 n8n으로 프록시.
| 프론트 (브라우저 호출) | 프록시 대상 (n8n) | 메서드 |
|---|---|---|
| `/api/trials` | `/webhook/trials/today` | GET (no-store) |
| `/api/trials/[id]` | `/webhook/trials/detail` | GET |
| `/api/trials/precheck` | `/webhook/trials/precheck` | PATCH |

핸들러 공통 동작:
1. 서버 환경변수에서 `N8N_BASE_URL`, `N8N_API_TOKEN` 로드.
2. n8n 호출 시 `x-api-key` 헤더 부착.
3. n8n 응답을 그대로 브라우저에 전달(민감정보 필터 필요 시 여기서).

## 9. 데이터 계약 (미확정 → 구현 전 확인 필요)
아래는 실제 DB 스키마 확인 후 확정한다. PRD는 논리 필드명 기준으로 작성됨.
- trial 테이블명 / 오늘 필터 기준 컬럼(trial_time or trial_date)
- mentor tier(elite/basic) 저장 컬럼, mentor_gender 컬럼
- status 가능한 값 목록
- pre_call_done / post_call_done 판정 기준
- converted 판정 기준(결제 완료? 특정 status?)
- precheck 1·2·3 저장 위치(별도 컬럼 vs 상태 테이블)

## 10. CTO 자문자답 (설계 근거)
**Q. 백엔드를 제대로 세우지, 왜 n8n을 API로 쓰나?**
A. DB 방화벽에 n8n 고정 IP만 열려 있고, 신규 서버 프로비저닝/IP 화이트리스트
   추가는 인프라 담당(Denise) 협의가 필요해 리드타임이 큼. 3명용 내부
   도구에 별도 백엔드는 과함. 있는 경로(n8n)를 재사용하는 게 합리적.

**Q. 인증을 로그인으로 안 하고 토큰 1겹이면 충분한가?**
A. 사용자 3명·URL 비공개·내부 도구. 로그인 시스템은 오버엔지니어링.
   단 개인정보가 있으므로 "URL 유출 시 무단 접근"은 막아야 함 → 토큰을
   서버(Route Handler)에만 두어 브라우저 비노출. 이게 최소 필요선.

**Q. semi-real-time인데 폴링/웹소켓 안 넣어도 되나?**
A. 필요 없음. 본인 조작은 optimistic update로 즉시 반영. 타인 변경의
   실시간 반영은 요구사항이 아님(3명이 같은 행을 동시에 만질 확률 낮음).
   창 복귀 시 refetch로 충분히 신선함. 웹소켓은 명백한 과설계.

**Q. 상단 카드용 집계 API를 따로 두지 않는 이유는?**
A. 오늘 데이터는 수십 건 규모. 목록을 어차피 받으므로 프론트에서 집계.
   집계 API 추가는 n8n 실행 횟수만 늘리는 낭비.

**Q. 서버 캐시(revalidate)를 왜 안 쓰나?**
A. 쓰기(체크박스)가 있는 화면이라 서버 캐시가 방금 쓴 값을 가림.
   대신 브라우저단 TanStack Query staleTime으로 과호출만 억제.

## 11. 마일스톤 (MVP)
1. n8n 워크플로우 3개 구축(today / detail / precheck) + 토큰 검사.
2. Next.js 프로젝트 + Route Handler 3개(프록시).
3. 목록 화면 + 대시보드 카드 + TanStack Query 연동.
4. 상세 패널 + call queue 이동.
5. 체크박스 optimistic update + 실패 롤백.
