# 004. 중복 쓰기 막기 — dirty 체크는 "무엇과 비교하는가"가 전부

## 한 줄로
dirty 체크 = 보낼 값이 **이미 저장된 값과 같으면 요청을 생략**하는 것.
어려운 건 생략 자체가 아니라 **비교 기준을 무엇으로 잡는가**다.

## 어떤 상황에서 쓰나
자동 저장·폼 제출·동기화처럼 "같은 내용을 여러 번 보낼 수 있는" 경로.
한 글자 썼다 지우기, 커서 이동, 편집기 내부 재직렬화 등으로 내용 변화 없는 저장이 쉽게 발생한다.

## 코드 요약

```tsx
// 이미 서버로 보낸 본문 = 비교 기준
const savedRef = useRef(note ?? "")

function handleChange(markdown: string, initialMarkdownNormalize: boolean) {
  if (initialMarkdownNormalize) {
    savedRef.current = markdown   // ★ 기준을 "에디터가 정규화한 초기 본문"으로 교체
    return
  }
  if (timerRef.current) clearTimeout(timerRef.current)
  timerRef.current = null

  if (markdown === savedRef.current) {   // 되돌아왔다 → 보낼 것이 없다
    pendingRef.current = null
    return
  }
  pendingRef.current = markdown
  timerRef.current = setTimeout(() => {
    savedRef.current = markdown          // 보낸 시점에 기준 갱신
    save(markdown)
  }, 3000)
}
```

실물: `frontend/src/features/trials/components/NotesEditor.tsx`

## 함정 — 실제로 여기서 틀렸다

처음엔 기준을 **서버에서 받은 원본 문자열**(`note` prop)로 잡았다. e2e가 바로 실패했다:
한 글자 쓰고 지워서 화면상 원래대로 돌아왔는데도 PATCH가 나갔다.

원인은 **에디터의 직렬화**다. MDXEditor는 마크다운을 파싱해 자기 규칙으로 다시 직렬화하므로,
공백·불릿 기호 등이 원본과 다를 수 있다. 즉 `에디터가 내보내는 문자열 ≠ DB에 저장된 문자열`인데
의미는 같다. 원본을 기준으로 두면 **첫 입력 이후 영원히 "dirty"** 로 판정된다.

해결은 라이브러리가 이미 알려주고 있었다 — `onChange(markdown, initialMarkdownNormalize)`의 두 번째 인자가
"이 호출은 초기 마크다운을 세팅하면서 발생한 정규화"라는 신호다. 그 값이 바로 **에디터 세계에서의 원본**이므로
기준으로 삼으면 된다.

일반화하면:

> 값이 **변환기를 통과한 뒤** 비교된다면, 기준도 같은 변환기를 통과한 값이어야 한다.
> (마크다운 직렬화, JSON 정규화, 날짜 포맷, 트림, 유니코드 정규화 모두 같은 함정)

곁들여 알아둘 것: **기준을 "보낸 시점"에 갱신할지 "성공한 시점"에 갱신할지**도 선택이다.
우리는 매 저장이 전체 본문을 보내는 full-body upsert라서, 실패해도 다음 입력 때 전체가 다시 실려 나간다 →
"보낸 시점" 갱신으로 충분하다. 부분 갱신(diff/patch) API라면 이 선택이 달라진다.

## 이 노트가 나온 작업
`frontend` `9303372`. 회귀를 막기 위해 `e2e/notes.spec.ts`에
"되돌린 편집은 저장 요청을 보내지 않는다" 테스트를 남겼다 — **버그를 고칠 때 그 버그를 잡아낸 테스트를 함께 남긴다.**
