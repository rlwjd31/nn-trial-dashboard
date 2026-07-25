@AGENTS.md
@docs/design.md

# Product Spec

이 프로젝트의 제품 요구사항은 [docs/PRD.md](docs/PRD.md) 에 정의되어 있다.
기능 구현·API·화면 작업 전 반드시 해당 문서를 참조한다.

핵심 요약:
- **목적**: Sales팀 3명용 내부 "오늘의 Trial" 대시보드 (MVP).
- **벤치마킹**: https://naonow-bi.vercel.app/sales_today_trials — **기능/정보구조 참조용**일 뿐. 디자인은 베끼지 않으며, PRD에 명시된 최소 기능만 구현한다.
- **디자인**: Modern + Glassmorphism (다크 기본). 토큰·규칙·컴포넌트 레시피는 [docs/design.md](docs/design.md) 가 단일 진실 공급원 — UI/스타일 작업 전 반드시 준수한다. (개요는 PRD §6.0.)
- **아키텍처**: 브라우저 → Next.js Route Handler(토큰·n8n URL 은닉) → n8n Webhook(고정 IP) → GCP Cloud SQL. 프론트는 DB에 직접 붙지 않는다.
- **인증**: 서버 전용 환경변수 `N8N_BASE_URL`, `N8N_API_TOKEN` (절대 `NEXT_PUBLIC_` 금지). n8n 호출 시 `x-api-key` 헤더 부착.
- **프록시 엔드포인트**: `/api/trials`(GET, no-store) · `/api/trials/[id]`(GET) · `/api/trials/precheck`(PATCH).
- **최신성**: TanStack Query `staleTime` 60s + `refetchOnWindowFocus`. 체크박스는 optimistic update(실패 시 롤백).
- **명시적 비목표**: 로그인 시스템, 실시간 동기화(웹소켓/폴링), 페이지네이션, 정렬/필터/검색 UI, 모바일 최적화 → 구현하지 않는다 (over-engineering 방지).
- **데이터 계약**: 실제 DB 스키마는 미확정. PRD §9 항목은 구현 전 확인이 필요하다.

# Domains & Contract (front / back 공유)

이 저장소는 두 도메인으로 나뉜다. 작업 전 자기 도메인 가이드를 읽고, 경계는 계약을 따른다.

- **공유 계약(boundary)**: [docs/contract/openapi.yaml](docs/contract/openapi.yaml) = API 모양의 단일 진실 공급원(SoT).
  변경 프로토콜·프론트 핸드오프: [docs/contract/api-contract.md](docs/contract/api-contract.md).
  응답/요청 모양을 바꿀 땐 **openapi 를 먼저** 고치고 front·back 이 각자 수렴한다.
- **프론트 도메인**: UI(`src/features`, `src/components`) + 프록시(`src/app/api`).
  가이드 = [docs/design.md](docs/design.md)(디자인·설계) + [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)(폴더 구조).
- **백엔드 도메인**: n8n 워크플로우 + DB(별도 repo `../n8n-workflows`). 가이드 = [docs/backend/guide.md](docs/backend/guide.md).
  배포 SoT = n8n 클라우드 워크플로우. **DDL·DB 변경은 DB 소유자**가 한다(`public` 스키마는 읽기 전용).
- **규칙**: 프론트는 `src/**` 만, 백엔드는 n8n/DB 만 건드린다. **엔드포인트·응답 모양의 최신 정의는 위 계약(openapi)이 우선**한다(아래 Product Spec 요약이 계약과 다르면 계약이 SoT).

# Commit Convention

이 저장소의 모든 commit 메시지는 반드시 아래 형태를 따른다.

```
[Type]: Description
```

- `[Type]` — 대괄호로 감싼 변경 유형 (아래 표 중 하나).
- `: ` — 콜론 + 공백 한 칸.
- `Description` — 변경 내용을 명령형 현재시제로 간결하게.

## 예시

```
[Feat]: add trials list route handler
[Fix]: correct precheck stage validation
[Docs]: update README data contract section
```

## Type 목록

| Type | 용도 |
|---|---|
| `Feat` | 새 기능 |
| `Fix` | 버그 수정 |
| `Docs` | 문서 변경 |
| `Style` | 포맷/세미콜론 등 동작에 영향 없는 변경 |
| `Refactor` | 기능 변화 없는 코드 구조 개선 |
| `Test` | 테스트 추가/수정 |
| `Chore` | 빌드/설정/의존성 등 그 외 |

## 규칙

- Type 은 위 표의 값만 사용한다.
- 표기는 위 표 그대로 쓴다 (`[Feat]`, `[Fix]` …).
- 한 commit 은 하나의 논리적 변경만 담는다.
