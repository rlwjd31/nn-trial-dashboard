# CLAUDE.md — 공용 (전 브랜치 공통)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **이 파일의 지위**: `trial-dashboard/` 최상위(= `main` 워크트리)에 있는 **공용 규칙 단일 사본**이다.
> 하위 워크트리(`frontend/` · `backend/`) 세션은 **파일시스템 상위 디렉터리 탐색**으로 이 파일을 자동 로드한다.
> 따라서 브랜치 간 복사·전파가 필요 없다. 자세한 규칙은 §Repository Topology.

@AGENTS.md
@docs/design.md

# Repository Topology (먼저 읽을 것)

⚠️ **`main` 브랜치에는 실행 코드가 없다.** `src/`·`package.json` 모두 없으며, 공용 지침·문서·API 계약만 있다.

```
trial-dashboard/            ← main 워크트리. 공용 규칙·문서의 단일 사본
├── CLAUDE.md               ← 이 파일 (하위 세션이 자동 상속)
├── AGENTS.md
├── docs/                   ← 공용 문서 (PRD·design·contract·backend)
├── frontend/               ← frontend 브랜치 워크트리
└── backend/                ← backend 브랜치 워크트리
```

| 브랜치 | 경로 | 소유 |
|---|---|---|
| `main` | `trial-dashboard/` | 공용 지침·문서·API 계약 (**코드 없음**) |
| `frontend` | `trial-dashboard/frontend/` | Next.js 앱 (`src/**`, 프록시 Route Handler, `e2e/`) |
| `backend` | `trial-dashboard/backend/` | n8n 워크플로우 + DB 레이어 설계 |

하위 두 폴더는 **git worktree** 다 (`git worktree list` 로 확인). 브랜치 전환 없이 폴더를 직접 열면 된다.
코드 작업 요청을 받으면 **해당 도메인 폴더에서** 파일을 읽고 고친다. `main` 최상위에서 `src/**` 를 찾지 말 것.
실행·빌드·테스트 명령은 전부 `frontend/` 에서 돌린다 (`main` 에는 `package.json` 이 없다). 상세는 `frontend/CLAUDE.md`.

## 공용 문서는 여기에만 있다 — 전파하지 않는다

- **공용 파일** = `CLAUDE.md` · `AGENTS.md` · `docs/**`. 이 세 묶음은 **`main` 워크트리(이 폴더)에만 존재**하며,
  `frontend`·`backend` 브랜치에서는 **삭제되어 있다**. 사본이 하나뿐이므로 divergence 가 원천적으로 불가능하다.
- **하위 세션은 자동 상속한다.** Claude Code 는 세션 cwd 에서 파일시스템 상위로 올라가며 `CLAUDE.md` 를 로드한다.
  `frontend/` 에서 작업하면 `frontend/CLAUDE.md`(도메인 규칙) + `trial-dashboard/CLAUDE.md`(이 파일, 공용) 이 함께 들어온다.
  **git 브랜치 계보와는 무관하다** — 파일시스템 부모/자식 관계만이 상속을 만든다.
- 그러므로 **공용 문서는 이 폴더에서만 고친다.** 도메인 브랜치에 공용 문서 사본을 되살리지 말 것 —
  되살리는 순간 두 사본이 동시에 컨텍스트에 들어와 어느 쪽이 진짜인지 알 수 없게 된다.
- 도메인 문서에서 공용 문서를 가리킬 땐 **상위 경로**를 쓴다: `frontend/CLAUDE.md` → `../docs/design.md`.
- 새 도메인 브랜치를 만들 때: `git worktree add ./<name> -b <name>` → `.gitignore` 에 `/<name>/` 추가 →
  그 브랜치에서 `git rm -r --cached docs AGENTS.md` 로 공용 사본 제거. 공용 규칙은 상속되므로 복사할 것이 없다.

## 이 레이아웃의 금지사항 (전부 실측 확인됨)

- ❌ **`git merge main` 금지.** `main` 은 `src/**`·`package.json`·`e2e/**` 를 삭제한 커밋(`65cca11`)을 갖고 있다.
  도메인 브랜치로 merge 하면 그 삭제가 전파되어 **앱이 통째로 사라진다.** 브랜치 간 공유 파일이 없으므로 merge 할 이유도 없다.
- ❌ **`main` 에서 `git clean -fdx` 금지.** `frontend/`·`backend/` 는 main 입장에서 ignored 이므로 `-x` 가 두 워크트리를 삭제한다.
- ❌ **`main` 에서 하위 워크트리를 `git add` 하지 말 것.** `.gitignore` 로 막혀 있지만, `-f` 로 강제하면
  frontend 의 `src/**` 전체가 main 트리로 빨려 들어간다.
- ⚠ **브랜치명 = 폴더명 모호성.** 폴더가 생겼으므로 `git log frontend` 는 `fatal: 애매한 인자` 를 낸다.
  `git log refs/heads/frontend` 또는 `git log frontend --` 로 쓴다. (손상은 없고 실패만 한다.)
- 다른 브랜치 파일을 읽기만 할 땐 폴더를 직접 열거나 `git show refs/heads/backend:src/lib/n8n.ts`.

# 도메인 경계와 계약

이 저장소는 두 도메인으로 나뉜다. 작업 전 자기 도메인 가이드를 읽고, 경계는 계약을 따른다.

- **공유 계약(boundary)**: [docs/contract/openapi.yaml](docs/contract/openapi.yaml) = API 모양의 단일 진실 공급원(SoT).
  변경 프로토콜·핸드오프: [docs/contract/api-contract.md](docs/contract/api-contract.md).
- **프론트 도메인**: UI(`src/features`, `src/components`) + 프록시(`src/app/api`).
  가이드 = [docs/design.md](docs/design.md)(디자인·설계, 위에서 자동 로드) + [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)(폴더 구조, feature-lite: 도메인은 `features/trials` 하나뿐).
  기능 스펙(해당 기능을 건드릴 때만): [docs/cloudtalk-call-button.md](docs/cloudtalk-call-button.md)(`ct+tel:` 딥링크·E.164) ·
  [docs/ptc-call-notes.md](docs/ptc-call-notes.md)(MDXEditor, `dynamic{ssr:false}`) · [docs/testing.md](docs/testing.md).
- **백엔드 도메인**: n8n 워크플로우 + DB. 가이드 = [docs/backend/guide.md](docs/backend/guide.md).
  배포 SoT = n8n 클라우드 워크플로우. **DDL·DB 변경은 DB 소유자**가 한다(`public` 스키마는 읽기 전용).
- **규칙**: 프론트는 `src/**` 만, 백엔드는 n8n/DB 만 건드린다. 엔드포인트·응답 모양의 최신 정의는 **계약(openapi)이 우선**한다
  (아래 Product Spec 요약이 계약과 다르면 계약이 SoT).

## 경계를 넘는 변경은 상대 도메인에 반드시 알린다

브랜치 간에는 대화가 없다. **문서가 유일한 알림 채널**이므로, 한 쪽만 고치고 끝내면 상대 도메인은 조용히 깨진다.
경계(요청·응답 모양, 경로, 에러 형태)를 건드리는 변경은 예외 없이 아래 순서를 지킨다.

1. **`docs/contract/openapi.yaml` 을 먼저 고친다.** 구현보다 계약이 앞선다.
2. **`docs/contract/api-contract.md` 의 상대 도메인 체크리스트에 항목을 추가한다** —
   "무엇이 바뀌었고, 상대가 어느 파일을 어떻게 고쳐야 하는가"를 적는다. 이 항목이 알림이다.
3. 자기 도메인을 수렴시키고, 상대 도메인 항목은 체크리스트에 **남겨둔 채** 커밋한다.
4. 공용 문서 수정이므로 **이 작업은 `main` 워크트리에서** 한다 (도메인 폴더에서 `docs/**` 를 만들지 말 것).

| 이런 변경이 생기면 | 상대가 해야 할 일 |
|---|---|
| 백엔드: 응답 필드 추가·삭제·개명, 타입 변경 | `src/types/trial.ts` → `lib/api.ts` → route handler → hooks → components → mock → `e2e/` 순으로 한 번에 수렴 |
| 백엔드: 엔드포인트 경로·메서드 변경 | `src/app/api/**` 폴더명 + `lib/api.ts` 호출 경로 수정 |
| 백엔드: 에러 응답 형태·상태코드 변경 | optimistic 롤백·토스트 경로가 여전히 맞는지 확인 |
| 프론트: 화면에 새 필드가 필요해짐 | [docs/contract/frontend-data-needs.md](docs/contract/frontend-data-needs.md) 에 근거를 적고 n8n 쿼리에 컬럼 추가 (DDL 필요 시 DB 소유자) |
| 양쪽: 계약과 코드가 이미 어긋난 걸 발견 | 체크리스트에 항목을 추가하고, 만지는 파일 범위 안에서 함께 정리 |

# Product Spec

이 프로젝트의 제품 요구사항은 [docs/PRD.md](docs/PRD.md) 에 정의되어 있다.
기능 구현·API·화면 작업 전 반드시 해당 문서를 참조한다.

핵심 요약:
- **목적**: Sales팀 3명용 내부 "오늘의 Trial" 대시보드 (MVP).
- **벤치마킹**: https://naonow-bi.vercel.app/sales_today_trials — **기능/정보구조 참조용**일 뿐. 디자인은 베끼지 않으며, PRD에 명시된 최소 기능만 구현한다.
- **디자인**: Modern + Glassmorphism (다크 기본). 토큰·규칙·컴포넌트 레시피는 [docs/design.md](docs/design.md) 가 단일 진실 공급원 — UI/스타일 작업 전 반드시 준수한다. (개요는 PRD §6.0.)
- **아키텍처**: 브라우저 → Next.js Route Handler(토큰·n8n URL 은닉) → n8n Webhook(고정 IP) → GCP Cloud SQL. 프론트는 DB에 직접 붙지 않는다.
- **인증**: 서버 전용 환경변수 `N8N_BASE_URL`, `N8N_API_TOKEN` (절대 `NEXT_PUBLIC_` 금지). n8n 호출 시 `x-api-key` 헤더 부착.
- **프록시 엔드포인트**(계약 기준): `/api/trials`(GET, no-store) · `/api/trials/{id}`(GET) · `/api/trials/pre-trial-call-check`(PATCH) · `/api/trials/note`(PATCH).
  ⚠️ 현재 프론트 코드는 구(舊) 이름(`/api/trials/precheck`)에 머물러 있고 `note` 라우트가 없다 — **계약 미수렴 상태**. 미반영 항목 목록은 [docs/contract/api-contract.md](docs/contract/api-contract.md) "프론트 변경 체크리스트".
- **최신성**: TanStack Query `staleTime` 60s + `refetchOnWindowFocus`. 체크박스는 optimistic update(실패 시 롤백).
- **명시적 비목표**: 로그인 시스템, 실시간 동기화(웹소켓/폴링), 페이지네이션, 정렬/필터/검색 UI, 모바일 최적화 → 구현하지 않는다 (over-engineering 방지).
- **데이터 계약**: `public` 스키마는 라이브 확인 완료([docs/backend/guide.md](docs/backend/guide.md) §4). 다만 **타임존(`startAt`) 은 미해결** 상태이고, PRD §9 의 나머지 미확정 항목은 구현 전 확인이 필요하다.

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
