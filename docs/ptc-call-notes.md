# 기능 스펙 — PTC 콜 메모 (Markdown Notes)

> 상태: **구현 완료**(frontend `1624483` — 저장까지 배선됨). 배치: `src/features/trials/components/TrialDetailSheet.tsx`
> 의 상세 필드 아래(발신/Call queue 버튼 근처). PTC(Pre-Trial Call) 진행 중
> 해당 고객에 대한 메모를 **마크다운으로 작성 → 자동 렌더 → 자동 저장**한다.

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
확정 저장처는 **`automation.trial_dashboard_state.sales_note`** (계약 openapi.yaml §`/trials/note`,
backend `ddl.sql`). trial 1건당 메모 1개이며, 마크다운 원문을 TEXT 로 그대로 담는다.

> 초기 스펙은 `public."CallQueueNotes"(type='sales')` 를 가정했으나 채택되지 않았다 —
> `public` 스키마는 읽기 전용이고(공용 CLAUDE.md §도메인 경계), 대시보드 자체 상태는
> `automation` 스키마에 모으기로 했다. 아래는 폐기된 안이므로 참고만 할 것.
>
> | 컬럼 | 매핑 |
> |---|---|
> | `callQueueId` | 해당 학생의 CallQueues.id |
> | `type` | `'sales'` (mentor 메모와 구분) |
> | `content` | 작성한 마크다운 원문(TEXT) |
> | `lessonId` | 이 trial의 Lessons.id |
> | `createdById` | 작성자(로그인 rep) userId |
>
> 작성자 기록(`createdById`)·행 누적(히스토리)은 현재 계약에 없다. 로그인 시스템이
> PRD 비목표이므로 작성자 추적은 함께 보류된 상태다.

원문(마크다운 문자열)을 그대로 저장하고, 렌더는 항상 프론트에서 한다
(저장은 순수 텍스트 → 안전·이식성).

## 4. 저장(persistence) — 확정·구현됨
- 계약: `PATCH /api/trials/note` → n8n `PATCH /webhook/trials/note`,
  body `{ trial_id, note }` → `sales_note` upsert. 읽기는 상세 응답의 `sales_note`
  (미기록이면 `null`). **빈 문자열 = 기록 삭제.**
- 자동 저장: MDXEditor `onChange` 는 스로틀되지 않으므로(키 입력마다 발생) **3초 디바운스**.
  저장 1회 = n8n 실행 1건이므로 짧게 두지 않는다(700ms 로 시작했다가 상향).
  디바운스 대기 중 시트를 닫거나 trial 을 바꾸면 마지막 입력이 유실되므로 **언마운트 시 flush** 한다.
- dirty 체크: 이미 보낸 본문과 같아지면(한 글자 썼다가 지움 등) 저장하지 않는다.
  비교 기준은 **에디터가 정규화한 초기 본문**(`onChange` 의 `initialMarkdownNormalize=true` 호출값)이다 —
  DB 원본 문자열로 비교하면 직렬화 차이 때문에 첫 입력 이후 영원히 dirty 로 판정된다.
  (배경: ../docs/learning/004-dirty-check.md)
- **남은 구멍**: 새로고침·탭 닫기는 언마운트가 아니므로 flush 가 돌지 않아, 대기 중 3초분이 유실될 수 있다.
  메우려면 `pagehide` + `fetch(keepalive:true)` 가 필요하다(도입 여부 미결정 — ../docs/learning/001-page-unload-save.md).
- optimistic update: `useNoteMutation` 이 상세 캐시(`trialKeys.detail`)를 먼저 고치고 실패 시 롤백+토스트.
  성공해도 재조회하지 않는다(에코 응답 = 방금 보낸 값). 자동 저장이 겹칠 때 옛 본문이 최신 본문을
  덮지 않도록 mutation `scope` 로 직렬화한다.
- `markdown` prop 은 **마운트 시점에만 읽힌다** → optimistic 값이 되돌아와도 편집 중 내용이
  덮이거나 커서가 튀지 않는다. trial 전환은 `TrialDetailSheet` 의 `key` 재마운트로 처리.

## 5. UI / 배치
- `TrialDetailSheet` 내부, 상세 필드 아래·버튼 위(또는 별도 섹션)에 "메모" 영역.
- 다크 글래스 톤(design.md §4). 에디터/프리뷰 컨테이너는 `.glass` 대신 내부 표면이므로
  투명 배경 + 얇은 구분선 정도로 가볍게(과한 중첩 유리 지양).
- 높이는 `contentEditableClassName="min-h-[220px]"`. 별도 세로 리사이즈 핸들은 없다
  (시트 자체가 좌측 핸들로 가로 리사이즈된다).
- 마크다운 요소 타이포는 `globals.css` 의 `.ptc-notes` 블록이 복원한다(에디터 리셋 상쇄).

## 6. 보안
- 마크다운 렌더 시 **XSS 주의** → 현재 상태·남은 확인 사항은 §8 마지막 항목.
- 내부 도구라도 학생 개인정보가 담기므로 원문은 서버(n8n/DB) 경유로만 저장한다.
  브라우저 localStorage 임시 저장은 제거됐다(§4).

## 7. 비목표
- 실시간 협업 편집, 멘션, 첨부파일/이미지 업로드 → 제외.
- 메모 버전 관리/히스토리 → 제외. 현재 계약은 trial 1건당 `sales_note` 1개 upsert다.
- WYSIWYG 리치 에디터 → 제외(마크다운 텍스트로 충분).

## 8. 완료 기준
- [x] 상세 패널에 마크다운 메모 작성 칸이 있다.
- [x] 마크다운 문법 입력 시 렌더(미리보기)가 된다 — `e2e/notes.spec.ts` 가 H1·목록 렌더를 단언.
- [x] 작성 내용이 마크다운 원문으로 저장/조회된다 — `sales_note`, 새로고침 후 유지까지 e2e 커버.
- [ ] 렌더가 XSS에 안전하다 — **미검증.** MDXEditor 는 `suppressHtmlProcessing` 를 켜지 않으면
      raw HTML 을 처리한다(현재 미설정). 내부 도구 + rep 본인이 작성한 내용만 들어오므로
      실질 위험은 낮지만, 확인 후 필요하면 해당 prop 을 켤 것.
