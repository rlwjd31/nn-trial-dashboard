# Trial Dashboard — backend (API 계층 + 계약)

`trial-dashboard` 레포의 **`backend` 브랜치**. 담당 범위는 두 가지다:

1. **n8n 워크플로우 + API 생성** — n8n Webhook(→ GCP Cloud SQL)과, 그것을 프록시하는
   Next Route Handler(`src/app/api/**`).
2. **계약 검증** — 응답 데이터가 API 스펙과 실제로 일치하는지 대조(`pnpm test:contract`).

**UI 는 이 브랜치에 없다.** 화면(컴포넌트·훅·스타일)은 `frontend` 브랜치 소유이며,
두 브랜치는 코드 의존 없이 **JSON 계약**([docs/contract/openapi.yaml](docs/contract/openapi.yaml))으로만 연결된다.

## 구조

```
docs/
├─ contract/
│  ├─ openapi.yaml            # ★ API 계약 SoT — 요청/응답 모양은 여기를 먼저 고친다
│  ├─ api-contract.md         # 프론트 handoff (계약 변경 시 프론트 할 일)
│  └─ frontend-data-needs.md  # UI 실사용 필드 역산
└─ backend/
   ├─ guide.md                # 백엔드 작업 규칙 (작업 전 필독)
   ├─ data-layer.md           # 쿼리·스키마 설계 이력
   ├─ ddl.sql                 # 상태 테이블 스펙 (DB 소유자가 실행)
   └─ workflow.ts             # 배포된 n8n 워크플로우의 기록 사본 (배포 수단 아님)

src/
├─ app/api/trials/
│  ├─ route.ts                        # GET   /api/trials  → n8n /webhook/trials/today
│  ├─ [id]/route.ts                   # GET   /api/trials/{id} → /webhook/trials/detail
│  ├─ pre-trial-call-check/route.ts   # PATCH → /webhook/trials/pre-trial-call-check
│  └─ note/route.ts                   # PATCH → /webhook/trials/note
├─ lib/
│  ├─ n8n.ts                  # 서버 전용 프록시 (x-api-key 부착, server-only)
│  └─ api.ts                  # 브라우저 → 자기 도메인 API 클라이언트 (계약의 클라 측면)
├─ types/trial.ts             # 계약 타입 (openapi.yaml 의 TS 표현)
└─ features/trials/mock/trials.mock.ts   # N8N_BASE_URL 미설정 시 서빙되는 mock

test/contract-check.mts       # 응답 ↔ openapi.yaml 대조 러너 (의존성 0)
```

## 환경 변수 (서버 전용)

`.env.example` 참고. `NEXT_PUBLIC_` 접두어 절대 금지.

| 변수 | 설명 |
|---|---|
| `N8N_BASE_URL` | n8n Webhook 베이스 URL (끝 슬래시 없이). **비어 있으면 mock 모드** |
| `N8N_API_TOKEN` | n8n `x-api-key` 헤더 토큰 |

## 개발

```bash
pnpm install
pnpm dev          # Route Handler 만 서빙 (화면 없음)
pnpm build        # 프로덕션 빌드
pnpm lint         # eslint

pnpm test:contract                    # mock 응답을 openapi.yaml 과 대조 (서버 불필요)
pnpm test:contract:selftest           # 검증기 자체 점검 (일부러 깨뜨린 응답을 잡는지)
node test/contract-check.mts --base http://localhost:3000/api        # 실행 중인 라우트 대조
node test/contract-check.mts --base https://<host>/webhook --n8n     # n8n 웹훅 직접 대조
```

## 현재 상태 / 블로커

- [x] n8n 워크플로우 "[Trial API] - Main" 4 엔드포인트 배포 (project Nao Now)
- [x] Route Handler 4개 + mock 폴백
- [x] 계약 검증 러너 (mock·라이브 모두 통과)
- [ ] **`automation.trial_dashboard_state` 생성** — DB 소유자가 [ddl.sql](docs/backend/ddl.sql) 실행.
      없으면 n8n 4 엔드포인트 전부 500 (`relation ... does not exist`).
- [ ] **타임존 보정** — `Lessons.startAt` 은 naive **UTC** 저장인데 쿼리가 `AT TIME ZONE 'Asia/Seoul'`
      만 적용 → 표시 시각 18시간 오차 + 오늘 필터 창 밀림. 상세는 [guide.md §4](docs/backend/guide.md).
- [ ] **워크플로우 발행 + `x-api-key`(Header Auth)** — 현재 `active: false`, 인증 `none`.
