# 기능 스펙 — PTC 콜 메모 (Markdown Notes)

> 상태: 구현 대기(스펙 확정). 배치: `src/features/trials/components/TrialDetailSheet.tsx`
> 의 상세 필드 아래(발신/Call queue 버튼 근처). PTC(Pre-Trial Call) 진행 중
> 해당 고객에 대한 메모를 **마크다운으로 작성 → 자동 렌더**한다.

## 1. 목적
Sales rep이 PTC 콜을 하며 고객 상담 내용을 상세 패널에서 즉시 기록.
마크다운 문법으로 작성하면 렌더된 결과를 볼 수 있어야 한다(목록/굵게/체크리스트 등).

## 2. 라이브러리 선택 (조사 결과)

| 후보 | 성격 | 적합성 |
|---|---|---|
| **`@uiw/react-md-editor`** ✅ 권장 | 라이브 프리뷰 **에디터**(작성+미리보기). textarea 기반(무거운 코드에디터 의존 없음), MIT, React 19/Next 검증, 다크모드(`data-color-mode`) | "작성 즉시 렌더" 요구에 가장 직접적. 도입 비용 최소 |
| `react-markdown` (+ shadcn `Textarea`) | **렌더 전용** 컴포넌트 + 직접 만든 Write/Preview 탭 | 가장 가볍고 글래스 테마에 100% 맞춤 가능. 단, 에디터 셸(탭·레이아웃)을 직접 구현 |
| `MDXEditor` | WYSIWYG(노션식) | UX 좋지만 무겁고 스타일이 강해 글래스 톤과 충돌 → 제외 |
| `Milkdown` | ProseMirror 플러그인 프레임워크 | 과설계 → 제외 |

### 결정
- **1순위: `@uiw/react-md-editor`** — 요구사항("작성하면 알아서 render")을 가장 적은 코드로 충족.
  설치: `pnpm add @uiw/react-md-editor`.
  - ⚠ 이 컴포넌트는 `window` 참조 → **클라이언트 전용**. Next App Router에서는
    `TrialDetailSheet`("use client") 안에서 `next/dynamic` + `{ ssr: false }` 로 로드.
    ```tsx
    const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });
    ```
  - 다크 글래스 톤: 래퍼에 `data-color-mode="dark"`, 배경은 투명 처리해 유리 표면 위에 얹는다.
- **대안(더 가볍게/완전 온브랜드): `react-markdown` + shadcn `Textarea` + Write/Preview 탭.**
  GFM(표·체크박스)용 `remark-gfm` 추가. 스타일을 Tailwind로 직접 잡아 글래스와 완전 일치.

## 3. 데이터 모델 (스키마 연계)
메모는 스키마상 **`CallQueueNotes`** 에 대응한다(../n8n-workflows/docs/schema/public/callqueues.md):

| 컬럼 | 매핑 |
|---|---|
| `callQueueId` | 해당 학생의 CallQueues.id |
| `type` | `'sales'` (mentor 메모와 구분) |
| `content` | **작성한 마크다운 원문(TEXT)** — 렌더는 프론트에서 |
| `lessonId` | 이 trial의 Lessons.id (연관 수업) |
| `createdById` | 작성자(로그인 rep) userId |

> 원문(마크다운 문자열)을 `content` 에 그대로 저장하고, 렌더는 항상 프론트에서 한다
> (저장은 순수 텍스트 → 안전·이식성).

## 4. 저장(persistence) — MVP 범위 주의
- 쓰기이므로 n8n 엔드포인트가 필요하다. **데이터 계약 미확정**(PRD §9와 동일 성격).
- 예상 계약(확정 필요):
  - `POST/PATCH /api/trials/[id]/notes` → n8n `/webhook/trials/notes`
    body: `{ trial_id, content }` → `CallQueueNotes(type='sales', ...)` upsert.
- **MVP 1차 범위**: 작성 칸 + 마크다운 렌더(라이브 프리뷰) + optimistic 저장 훅 골격.
  실제 저장 배선은 위 계약 확정 후. 확정 전에는 상세 조회 시 `content` 를 표시만 해도 됨.

## 5. UI / 배치
- `TrialDetailSheet` 내부, 상세 필드 아래·버튼 위(또는 별도 섹션)에 "메모" 영역.
- 다크 글래스 톤(design.md §4). 에디터/프리뷰 컨테이너는 `.glass` 대신 내부 표면이므로
  투명 배경 + 얇은 구분선 정도로 가볍게(과한 중첩 유리 지양).
- 높이는 적당히(예: 200px), 세로 리사이즈 허용.

## 6. 보안
- 마크다운 렌더 시 **XSS 주의**. `react-markdown` 은 기본적으로 raw HTML 비활성(안전).
  `@uiw/react-md-editor` 프리뷰는 `rehype-sanitize` 를 적용한다.
- 내부 도구라도 학생 개인정보가 담기므로 원문은 서버(n8n/DB) 경유로만 저장.

## 7. 비목표
- 실시간 협업 편집, 멘션, 첨부파일/이미지 업로드 → 제외.
- 메모 버전 관리/히스토리 → 제외(단, `CallQueueNotes` 는 행 누적 가능 — 추후).
- WYSIWYG 리치 에디터 → 제외(마크다운 텍스트로 충분).

## 8. 완료 기준
- [ ] 상세 패널에 마크다운 메모 작성 칸이 있다.
- [ ] 마크다운 문법 입력 시 렌더(미리보기)가 된다(목록·굵게·체크박스 등 GFM).
- [ ] (배선 시) 작성 내용이 `content`(마크다운 원문)로 저장/조회된다.
- [ ] 렌더가 XSS에 안전하다(raw HTML 비활성 또는 sanitize).
