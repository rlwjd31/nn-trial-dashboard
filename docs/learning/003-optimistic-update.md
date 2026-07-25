# 003. Optimistic update · 롤백 · mutation 직렬화 (TanStack Query)

## 한 줄로
Optimistic update = **서버 응답을 기다리지 않고 캐시를 먼저 고쳐** 화면을 즉시 바꾸고,
실패하면 미리 떠둔 이전 값으로 되돌리는 것.

## 어떤 상황에서 쓰나
본인이 방금 한 조작이 즉시 반영돼야 하는 UI — 체크박스, 좋아요, 자동 저장.
왕복 지연(우리는 브라우저 → Route Handler → n8n → Cloud SQL)이 그대로 노출되면 클릭이 씹힌 것처럼 느껴진다.

## 코드 요약

```ts
useMutation({
  mutationFn: saveNote,
  onMutate: async (vars) => {
    const key = trialKeys.detail(vars.trial_id)
    await qc.cancelQueries({ queryKey: key })      // ① 진행 중 refetch 취소 (응답이 내 낙관값을 덮는 것 방지)
    const prev = qc.getQueryData<TrialDetail>(key) // ② 롤백용 스냅샷
    qc.setQueryData<TrialDetail>(key, (old) =>     // ③ 캐시를 먼저 고친다
      old ? { ...old, sales_note: vars.note } : old)
    return { prev, key }                           // ④ onError로 넘긴다
  },
  onError: (err, _vars, ctx) => {
    if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev)   // ⑤ 되돌리고
    toast.error("저장 실패 — 이전 상태로 되돌렸습니다")      // ⑥ 알린다
  },
})
```

실물: `frontend/src/features/trials/hooks/useNoteMutation.ts` · `usePrecheckMutation.ts`

**성공 시 invalidate하지 않는 선택**도 의도적이다. 응답은 방금 보낸 값의 에코이므로 재조회할 이유가 없고,
재조회는 n8n 실행을 한 건 더 쓴다. *"성공하면 무조건 invalidate"는 반사행동이지 규칙이 아니다.*

## 함정

**1. `cancelQueries`를 빼먹으면** 진행 중이던 refetch 응답이 뒤늦게 도착해 낙관적 값을 덮는다. 원인 찾기 어려운 "값이 되돌아감" 버그.

**2. 낙관값이 입력 컴포넌트로 되돌아오면 커서가 튄다.**
자동 저장 + optimistic을 함께 쓰면 캐시 갱신 → prop 변경 → 에디터 내용 리셋의 고리가 생길 수 있다.
우리는 MDXEditor의 `markdown` prop이 **마운트 시점에만 읽힌다**는 사실(라이브러리 타입 주석)로 안전을 확보하고,
항목 전환은 부모의 `key` 재마운트로 처리했다. → 제어 컴포넌트에 optimistic을 붙일 때는
**"이 값이 다시 흘러들어오면 무슨 일이 나는가"를 먼저 확인**한다.

**3. 쓰기가 겹치면 순서가 뒤집힌다.**
mutation은 기본적으로 **병렬** 실행이라, 자동 저장 A·B가 겹치면 늦게 도착한 옛 본문이 최신을 덮을 수 있다.
같은 `scope.id`를 주면 **직렬 실행**된다:

```ts
useMutation({ mutationFn: saveNote, scope: { id: "trial-note" } })
```

`scope`는 정적 값이라 변수(`trial_id`)로 나눌 수 없다. 우리는 한 번에 한 항목만 편집하므로 고정 id로 충분했다 —
**제약을 확인하고 "우리 상황에선 충분하다"까지 판단하는 것**이 설계다.

## 이 노트가 나온 작업
`frontend` `1624483`. 체크박스(`usePrecheckMutation`)와 메모(`useNoteMutation`)가 같은 패턴의
두 사례이므로 나란히 읽으면 좋다 — 전자는 목록 캐시, 후자는 상세 캐시를 고친다.
