# 010. FK 가 없으면 존재 검증은 쿼리가 한다 — upsert 가 조용히 성공하는 문제

## 한 줄로
부모 테이블로의 FK 가 없으면, 자식 테이블의 `INSERT ... ON CONFLICT` 는
**존재하지 않는 부모 id 를 아무 불평 없이 받아들인다.**
DB 가 막아주지 않으므로 존재 검증을 **쓰기 쿼리 자체**에 넣고, `RETURNING` 의 0행을 "없음" 신호로 쓴다.

## 어떤 상황에서 쓰나

`automation.trial_dashboard_state` 는 `public."Lessons"` 로 FK 를 걸 수 없다([008](./008-cross-schema-fk-and-references-privilege.md) —
`REFERENCES` 권한이 없다). 그 상태로 메모 저장 쿼리가 이랬다:

```sql
INSERT INTO automation.trial_dashboard_state AS d (lesson_id, sales_note)
VALUES ($1::int, NULLIF($2, ''))
ON CONFLICT (lesson_id) DO UPDATE SET sales_note = ..., updated_at = now()
```

`lesson_id = 99999999` 처럼 **없는 trial** 로 호출해도 성공한다. 결과는 두 가지 손상이다.

1. API 가 `{"ok": true}` 를 돌려준다 — 계약(`openapi.yaml`)은 이 경우 **404** 를 요구한다.
2. 부모 없는 **고아 행**이 하나 생긴다.

FK 가 있었다면 DB 가 대신 막아줬을 일이다. 없으니 아무도 안 막는다.

## 코드 요약

`VALUES` 를 **부모 테이블에서 읽는 `SELECT`** 로 바꾸면, 부모가 없을 때 삽입할 행 자체가 없어진다.
`RETURNING` 을 붙여 "썼는가"를 밖으로 내보낸다:

```sql
INSERT INTO automation.trial_dashboard_state AS d (lesson_id, sales_note)
SELECT l.id, NULLIF($2, '')
FROM public."Lessons" l
WHERE l.id = $1::int              -- ← 존재 검증이 여기 들어간다
ON CONFLICT (lesson_id) DO UPDATE SET
  sales_note = NULLIF($2, ''),
  updated_at = now()
RETURNING d.lesson_id::text AS trial_id
```

- 부모 있음 → 1행 삽입/갱신 + `RETURNING` 1행
- 부모 없음 → **아무 일도 안 일어나고** `RETURNING` 0행

호출측은 0행을 404 로 번역한다. 검증과 쓰기가 한 문장이라 **원자적**이라는 것도 이득이다 —
"먼저 SELECT 로 확인하고 그 다음 INSERT" 는 두 문장 사이에 부모가 삭제되는 창을 남긴다.

실물: `backend/docs/backend/workflow.ts` (`Upsert Note` · `Upsert Pre-trial Call Check`)

## 함정

**1. "0행"이 호출측까지 도달하는지 확인한다.**
n8n Postgres 노드는 0행이면 아이템을 **하나도** 내보내지 않는다. 그러면 다음 노드가 아예 실행되지
않아 404 분기도 안 탄다. `alwaysOutputData: true` 를 켜야 빈 아이템 `{}` 이라도 흘러간다.
어느 스택이든 "결과 없음"을 **값으로** 표현할 방법을 정해두지 않으면 분기 자체가 사라진다.

**2. strict 타입 검증은 "없음"에서 죽는다 — 실제로 틀렸던 지점.**
0행일 때 `$json.trial_id` 는 `undefined` 다. n8n IF 노드의 `typeValidation: 'strict'` 는 문자열
연산자에 `undefined` 가 오면 **타입 에러로 실행을 중단**한다. 404 분기로 가는 게 아니라 500 이 난다.
`loose` 로 바꿔야 undefined 가 falsy 로 평가돼 의도한 분기를 탄다.

> 더 나쁜 건 **이게 조용했다는 점**이다. 상세 조회(`Detail found?`)는 이 구성으로 한동안 배포돼
> 있었고, "없는 id 로 부르면 404" 가 실제로는 한 번도 동작하지 않았을 가능성이 높다.
> 정상 경로만 테스트하면 영원히 안 보인다.

**3. 검증 조건을 부모 쪽에 얼마나 걸지는 별도 결정이다.**
`WHERE l.id = $1::int` 만 걸었다. `AND l."isTrial" = TRUE` 를 더 걸면 "trial 이 아닌 Lesson" 도
404 가 되는데, 그러면 **PATCH 가 GET 보다 엄격**해진다(상세 조회는 `isTrial` 을 안 본다).
읽기와 쓰기의 존재 판정이 갈리면 "조회는 되는데 저장은 404" 같은 이상한 상태가 나온다. 맞췄다.

**4. 고아 행은 여전히 남을 수 있다.**
이 쿼리는 **쓰는 시점**의 존재만 보장한다. 이후 부모가 하드 삭제되면 고아가 된다.
FK 를 포기한 대가는 사라지지 않으므로 정리 쿼리는 계속 필요하다(`ddl.sql` 하단).

## 이 노트가 나온 작업
- 브랜치 `backend` (2026-07-26), 커밋 `685d8b2`
- `docs/backend/workflow.ts` — `Upsert Note` · `Upsert Pre-trial Call Check` 를 `VALUES` → `SELECT ... RETURNING`,
  `Precheck found?` · `Note found?` IF 노드 추가, 세 IF 모두 `typeValidation` 을 `loose` 로
- ⚠ **미검증**: 404 분기는 프로덕션 DB 쓰기라 end-to-end 로 돌리지 않았다. 논리와 노드 구성만 확인했다.
