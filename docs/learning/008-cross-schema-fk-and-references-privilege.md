# 008. 크로스 스키마 FK 와 `REFERENCES` 권한 — 제약을 만들 권한은 따로 있다

## 한 줄로
외래키를 만드는 데는 대상 테이블의 **`REFERENCES` 권한**이 필요하다.
`SELECT` 가 된다고 FK 를 걸 수 있는 게 아니다 — 읽기 전용 스키마를 참조하는 DDL 은 이걸로 조용히 막힌다.

## 어떤 상황에서 쓰나

대시보드 상태를 담을 새 테이블을 `automation` 스키마에 만들면서, 원천 테이블
`public."Lessons"` 를 참조하는 FK 를 넣었다:

```sql
lesson_id INTEGER PRIMARY KEY
          REFERENCES public."Lessons"(id) ON UPDATE CASCADE ON DELETE CASCADE
```

문서상 완벽해 보였지만 **실행하면 실패한다.** n8n 이 접속하는 역할로 실측한 결과:

| 권한 | 값 |
|---|---|
| `has_schema_privilege('automation','CREATE')` | `true` |
| `has_table_privilege('public."Lessons"','SELECT')` | `true` |
| `has_table_privilege('public."Lessons"','REFERENCES')` | **`false`** |

읽을 수는 있지만 참조할 수는 없다. FK 를 넣은 DDL 은 permission denied 로 **테이블 자체가 안 생긴다.**

## 코드 요약

FK 를 빼고, 관례에 맞춰 맨 정수 컬럼으로 둔다:

```sql
CREATE TABLE IF NOT EXISTS automation.trial_dashboard_state (
    lesson_id              INTEGER PRIMARY KEY,   -- = public."Lessons".id. FK 없음
    pre_trial_call_checks  BOOLEAN[] NOT NULL DEFAULT ARRAY[false, false, false],
    sales_note             TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trial_dashboard_state_checks_len3
        CHECK (array_length(pre_trial_call_checks, 1) = 3)
);
```

FK 를 버린 대가는 **고아 행**이다. 원천 행이 하드 삭제되면 남는다. 그래서 정리 쿼리를 문서에 함께 적었다:

```sql
DELETE FROM automation.trial_dashboard_state d
 WHERE NOT EXISTS (SELECT 1 FROM public."Lessons" l WHERE l.id = d.lesson_id);
```

실물: `backend/docs/backend/ddl.sql`

## 함정

**1. "관례"는 추측하지 말고 실측한다.**
FK 를 뺀 결정의 두 번째 근거는 **그 스키마의 기존 41개 테이블 중 public 을 참조하는 FK 가 0건**이라는
사실이었다. `trial_reminder_log` · `pre_trial_survey_logs` · `paid_class_reminder_jobs` 전부
`lesson_id integer` 로만 들고 있다. 카탈로그를 한 번 조회하면 나오는 정보다:

```sql
SELECT c.relname, (SELECT count(*) FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype='f')
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'automation';
```

같은 조회로 **타입 관례**도 잡혔다 — 기존 테이블은 전부 `timestamp with time zone`(정밀도 수식 없음)인데
초안은 `TIMESTAMPTZ(3)` 였다. 새 테이블을 남의 스키마에 얹을 때는 소유자·타입·네이밍을 먼저 센다.

**2. 스키마 소유자와 테이블 소유자는 다를 수 있다.**
`automation` 스키마 owner 는 `naonower` 인데 그 안의 테이블 owner 는 전부 `automation_coupons`(= 앱이
접속하는 역할)였다. 그래서 **앱 역할로 DDL 을 실행하는 게** 관례에 맞고 GRANT 도 불필요하다.
다른 역할로 만들었다면 `GRANT SELECT, INSERT, UPDATE, DELETE ... TO automation_coupons` 가 필요하다.
"DDL 은 무조건 소유자/슈퍼유저로" 는 반사행동이지 규칙이 아니다.

**3. soft-delete 컬럼 유무가 FK 의 위험도를 바꾼다.**
`public."Lessons"` 에는 `deleted%` 컬럼이 없다(확인) → 하드 삭제가 가능하다는 뜻이고,
그래서 `ON DELETE CASCADE` 가 실제로 발동할 수 있는 FK 였다. soft-delete 만 쓰는 테이블이면
같은 FK 의 위험도는 훨씬 낮다. 결정 전에 삭제 방식을 본다.

## 이 노트가 나온 작업
- 브랜치 `backend` (2026-07-25)
- `docs/backend/ddl.sql` — FK 제거 · `TIMESTAMPTZ(3)`→`TIMESTAMPTZ` · `created_at` 추가 · 배열 길이 CHECK · GRANT
- 검증 방식: n8n 임시 워크플로우로 `pg_class`/`pg_attribute`/`has_*_privilege` 조회 후 아카이브
  (DDL 실행은 하지 않음 — DB 소유권은 사용자에게 있다)
