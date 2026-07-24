# 기능 스펙 — PTC 콜 메모 (Markdown Notes)

> 상태: 구현 대기(스펙 확정). 배치: `src/features/trials/components/TrialDetailSheet.tsx`
> 의 상세 필드 아래(발신/Call queue 버튼 근처). PTC(Pre-Trial Call) 진행 중
> 해당 고객에 대한 메모를 **마크다운으로 작성 → 자동 렌더**한다.

## 1. 목적
Sales rep이 PTC 콜을 하며 고객 상담 내용을 상세 패널에서 즉시 기록.
마크다운 문법으로 작성하면 렌더된 결과를 볼 수 있어야 한다(목록/굵게/체크리스트 등).

## 2. 라이브러리 선택 (조사 + 요구사항 확정)

> 요구 UX 확정: **분할 미리보기가 아니라 Notion/Typora식 "입력 즉시 인플레이스 변환"**
> (예: `# Title` 타이핑 순간 그 자리에서 H1로 렌더). → WYSIWYG 에디터가 정답.

| 후보 | 성격 | 적합성 |
|---|---|---|
| **`@mdxeditor/editor`** ✅ 채택 | **WYSIWYG**(노션식) 마크다운 에디터. `markdownShortcutPlugin` 이 `# `·`- `·`**` 등을 입력 즉시 변환. Lexical 기반, React 18/19 | **인플레이스 렌더 요구를 유일하게 충족.** 좁은 시트에서도 단일 pane |
| `@uiw/react-md-editor` | textarea + **별도** 프리뷰(edit/live/preview) | 인플레이스 변환 불가(분할 미리보기라 좁은 시트에 부적합) → 제외 |
| `react-markdown` (+ `Textarea`) | 렌더 전용 + 직접 만든 탭 | 인플레이스 아님 → 제외 |
| `Milkdown` | ProseMirror 프레임워크 | 과설계 → 제외 |

### 결정
- **채택: `@mdxeditor/editor`** — `pnpm add @mdxeditor/editor`.
  - ⚠ 클라이언트 전용(`window` 참조) → Next App Router **공식 패턴**: 플러그인·CSS를 담은
    `InitializedMDXEditor` 를 만들고 `NotesEditor` 에서 `next/dynamic { ssr:false }` 로 로드.
  - CSS: `import "@mdxeditor/editor/style.css";` (초기화 컴포넌트에서).
  - 다크: `<MDXEditor className="dark-theme" … />`.
  - 최소 플러그인: `headingsPlugin, listsPlugin, quotePlugin, thematicBreakPlugin,
    linkPlugin, markdownShortcutPlugin`. (마지막이 인플레이스 변환의 핵심)

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
