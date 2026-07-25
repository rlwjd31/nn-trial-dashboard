# Trial Dashboard — 공유 문서 베이스 (`main`)

이 브랜치(`main`)는 **프론트/백엔드 공통 지침·문서·API 계약의 단일 소스**다.
실제 실행 코드는 도메인별 브랜치에 있으며, `main` 에는 코드가 없다.

## 브랜치 / 워크트리 구조

| 브랜치 | 워크트리 경로 | 소유 |
|---|---|---|
| `main` | `trial-dashboard/` | 공용 지침·문서·API 계약 (이 브랜치, **코드 없음**) |
| `frontend` | `trial-dashboard-frontend/` | Next.js 프론트 앱 (`src/**`, 프록시 Route Handler, e2e) |
| `backend` | `trial-dashboard-backend/` | n8n 워크플로우 + DB 레이어 설계 |

```bash
git worktree list   # 세 워크트리 확인
```

## 경계 = 계약 (Source of Truth)

- **`backend/docs/contract/openapi.yaml`** — API 엔드포인트/응답 모양의 단일 진실 공급원.
- 변경 프로토콜: `backend/docs/contract/api-contract.md`. 요청/응답 모양을 바꿀 땐
  **openapi 를 먼저** 고치고 front · back 이 각자 수렴한다.
- 프론트 데이터 요구: `backend/docs/contract/frontend-data-needs.md`.

## 문서 지도

- **공통 지침**: `CLAUDE.md`(도메인·계약·커밋 규약), `AGENTS.md`(Next 16 주의)
- **제품**: `docs/PRD.md`
- **프론트 도메인**: `docs/design.md`(디자인·설계 SSOT), `docs/ARCHITECTURE.md`(폴더 구조)
  — 기능 스펙: `docs/cloudtalk-call-button.md`, `docs/ptc-call-notes.md`, `docs/testing.md`
- **백엔드 도메인**: `backend/docs/backend/guide.md`, `backend/docs/backend/data-layer.md`,
  `backend/docs/backend/ddl.sql`, `backend/docs/backend/workflow.ts`

## 문서 소유 브랜치 (사본을 만들지 않는다)

| 문서 | 소유 브랜치 | 편집 위치 |
|---|---|---|
| `CLAUDE.md` · `AGENTS.md` · `docs/PRD.md` · `docs/design.md` · `docs/ARCHITECTURE.md` · 기능 스펙 | `main` | 이 워크트리 |
| `docs/contract/**` (계약 SoT) · `docs/backend/**` (n8n·DB) | **`backend`** | `backend/` 워크트리 |

각 문서는 **소유 브랜치 한 곳에만** 존재한다. 다른 브랜치에서는 읽기만 하며,
워크트리가 중첩돼 있으므로 경로로 바로 열 수 있다(`backend/docs/contract/openapi.yaml`).
브랜치 안에서 읽어야 하면 `git show refs/heads/backend:docs/contract/openapi.yaml`.

`main` 소유 문서를 바꿨을 때만 도메인 브랜치로 전파한다:

```bash
git switch frontend && git merge main
git switch backend  && git merge main
```
