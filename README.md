# Sales Today-Trials Dashboard

Sales 팀 내부용 "오늘의 Trial" 대시보드 (MVP). 브라우저 → Vercel Route
Handler → n8n Webhook → GCP Cloud SQL 구조로, n8n 토큰과 URL은 서버에만 둔다.

## 기술 스택

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS 4**
- **TanStack Query 5** (캐싱 + optimistic update)
- 패키지 매니저: **pnpm**
- 배포: Vercel

## 환경 변수 (서버 전용)

`.env.example` 참고. `NEXT_PUBLIC_` 접두어 절대 금지 — 브라우저에 노출되면 안 됨.

| 변수 | 설명 |
|---|---|
| `N8N_BASE_URL` | n8n Webhook 베이스 URL (끝 슬래시 없이) |
| `N8N_API_TOKEN` | n8n `x-api-key` 헤더 토큰 |

로컬: `.env.local` 에 값 채우기 (git 무시됨).
배포: Vercel 프로젝트 Environment Variables 에 등록.

## 개발

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # 프로덕션 빌드
pnpm lint       # eslint
```

## 구조

```
src/
├─ app/
│  ├─ layout.tsx           # Providers(TanStack Query) 주입
│  ├─ providers.tsx        # QueryClient (staleTime 60s, refetchOnWindowFocus)
│  ├─ page.tsx             # 대시보드 (현재 placeholder)
│  └─ api/trials/
│     ├─ route.ts          # GET  /api/trials         → n8n /webhook/trials/today
│     ├─ [id]/route.ts     # GET  /api/trials/[id]     → n8n /webhook/trials/detail
│     └─ precheck/route.ts # PATCH /api/trials/precheck → n8n /webhook/trials/precheck
├─ lib/
│  ├─ n8n.ts               # 서버 전용 n8n 프록시 (x-api-key 부착)
│  └─ api.ts               # 브라우저 → 자기 도메인 API 클라이언트
└─ types/
   └─ trial.ts             # API 계약 타입 (PRD 섹션 7)
```

## 진행 상태

- [x] 마일스톤 2: Next.js 프로젝트 + Route Handler 3개(프록시 골격)
- [ ] 마일스톤 1: n8n 워크플로우 3개 (프론트 이후 별도 진행)
- [ ] 마일스톤 3: 목록 화면 + 대시보드 카드 + TanStack Query 연동
- [ ] 마일스톤 4: 상세 패널 + call queue 이동
- [ ] 마일스톤 5: 체크박스 optimistic update + 롤백

## ⚠️ 구현 전 확정 필요 (PRD 섹션 9 — 데이터 계약)

`src/types/trial.ts` 는 PRD 논리 필드명 기준. 실제 DB 스키마 확인 후 조정:

- trial 테이블명 / 오늘 필터 기준 컬럼 (`trial_time` or `trial_date`)
- mentor tier(elite/basic) 저장 컬럼, `mentor_gender` 컬럼
- `status` 가능한 값 목록
- `pre_call_done` / `post_call_done` 판정 기준
- `converted` 판정 기준
- precheck 1·2·3 저장 위치 (별도 컬럼 vs 상태 테이블)
