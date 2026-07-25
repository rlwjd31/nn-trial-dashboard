# 009. naive timestamp 에 UTC 가 들어 있을 때 — `AT TIME ZONE` 의 방향과 위치

## 한 줄로
`timestamp without time zone` 은 **"이 값이 어느 존인지"를 저장하지 않는다.**
그래서 `AT TIME ZONE` 을 걸 때 컬럼이 이미 어느 존인지는 DB 가 모르고, 우리가 **가정**한다 —
방향을 반대로 잡으면 조용히 틀리고, 거는 **위치**를 잘못 잡으면 인덱스가 죽는다.

## 어떤 상황에서 쓰나

`public."Lessons"."startAt"` 은 `timestamp without time zone` 인데 **값이 UTC** 다.
"오늘(KST) trial 목록"을 뽑으려고 이렇게 썼다:

```sql
WHERE (l."startAt" AT TIME ZONE 'Asia/Seoul')::date >= '2026-07-27'
  AND (l."startAt" AT TIME ZONE 'Asia/Seoul')  <  '2026-07-28'
```

KST 7/27 = UTC `[07-26 15:00, 07-27 15:00)` 이 나와야 하는데, 실제로 걸린 하한은 `07-27 09:00` 이었다.
**18시간 밀렸다.**

이유는 연산자의 정의 그대로다. `naive AT TIME ZONE 'Asia/Seoul'` 의 뜻은
"이 naive 값을 **서울 벽시계로 해석**해서 instant 로 바꿔라" → 결과 instant = `naive - 9h`.
값이 이미 UTC 인데 "서울 시각이었다"고 선언한 셈이라 9시간을 **뺐다**. 필요한 건 `+9h` 였다.

거기에 `::date` 와 문자열 리터럴 비교가 **세션 TimeZone** 을 한 번 더 타서 오차가 겹쳤다:

| 세션 TimeZone | 실제 걸린 구간(naive UTC) | 의도 대비 |
|---|---|---|
| `UTC` (psql) | `[07-27 09:00, 07-28 09:00)` | **+18h** |
| `Asia/Seoul` (GUI) | `[07-27 00:00, 07-28 00:00)` | **+9h** |

같은 쿼리가 클라이언트에 따라 다른 행을 낸다. 그래서 이 형태는 **수동 테스트의 근거로도 쓸 수 없다.**

## 코드 요약

규칙은 하나로 줄었다: **naive(UTC) + 9h = KST 벽시계.**
그리고 변환은 **컬럼이 아니라 경계값 쪽**에 건다.

```sql
-- 표시: UTC 로 저장된 값을 서울 벽시계로 렌더 (매직 넘버 9 없음)
to_char((l."startAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS') || '+09:00'

-- 필터: 컬럼은 맨몸, 경계만 옮긴다
WHERE l."startAt" >= ($1::timestamptz AT TIME ZONE 'UTC')
  AND l."startAt" <  ($2::timestamptz AT TIME ZONE 'UTC')
```

`AT TIME ZONE` 두 번의 역할이 다르다는 게 핵심이다.
`timestamp → timestamptz` 는 "이 벽시계가 어느 존인지 선언", `timestamptz → timestamp` 는
"이 instant 를 그 존의 벽시계로 렌더". 둘을 이어 붙이면 좌표계 변환이 된다.

`$1`/`$2` 는 SQL 이 아니라 **호출측**이 만든다. n8n Set 노드가 Luxon 으로:

```
kst_from = {{ $now.setZone('Asia/Seoul').startOf('day').toISO() }}
kst_to   = {{ $now.setZone('Asia/Seoul').startOf('day').plus({ days: 1 }).toISO() }}
```

실물: `backend/docs/backend/workflow.ts` (`KST Day Window` · `Query Today`)

## 함정

**1. 방향을 못 정하는 건 컬럼 타입 탓이다 — 진짜 해결은 타입을 고치는 것.**
`timestamptz` 였다면 이 노트 전체가 필요 없다. 값이 instant 로 저장되니
`date_trunc('day', now(), 'Asia/Seoul')` 한 줄로 끝난다. 지금 쿼리가 못생긴 이유는 SQL 실력이
아니라 **모델이 틀려서**다. 고칠 수 없는 상황(ORM·소유권)이면 차선책은 **변환을 매 쿼리에서 하지 않는 것** —
경계 계산을 호출측으로 밀어내거나 immutable 함수로 한 번만 쓰고 숨긴다.

**2. 컬럼을 감싸면 인덱스가 죽는다.**
`(l."startAt" AT TIME ZONE ...)` 처럼 컬럼을 함수로 감싸면 `startAt` 인덱스를 못 쓴다.
실측: 경계 쪽에 걸면 `Lessons_mentorId_isMock_status_startAt_idx` Bitmap Index Scan **6.85ms**,
컬럼을 감싸면 Seq Scan **27ms**. 같은 결과를 내는 두 식의 차이가 이것뿐일 때, 어디에 거느냐가
전부다. 표시용(SELECT 절)은 감싸도 무해하다 — 필터가 아니기 때문이다.

**3. 오프셋 없는 문자열을 `::timestamptz` 로 캐스팅하면 세션 TimeZone 이 끼어든다.**
현재 안전한 이유는 Luxon `.toISO()` 가 `2026-07-26T00:00:00.000+09:00` 처럼 **오프셋을 붙이기** 때문이다.
오프셋이 있으면 파싱이 세션과 무관해진다. 오프셋이 빠지는 순간 같은 코드가 조용히 다른 구간을 만든다.

**4. `current_date` 는 세션 TimeZone 을 탄다.**
"오늘"을 SQL 에서 구할 때 `current_date` 를 쓰면 psql(UTC)과 GUI(Asia/Seoul)에서 다른 날이 나온다.
`now() AT TIME ZONE 'Asia/Seoul'` 처럼 존을 명시해야 한다.

**5. `AT TIME ZONE` 은 `+` 보다 결합력이 세다.**
`x::date + 1 AT TIME ZONE 'Asia/Seoul'` 은 `1 AT TIME ZONE ...` 으로 파싱돼 에러난다.
괄호가 필요하다: `((x::date + 1) AT TIME ZONE 'Asia/Seoul')`.

**6. 어느 존인지는 추론하지 말고 대조한다.**
"UTC 일 것이다"는 처음엔 `max(createdAt) ≈ now()` 라는 약한 근거였다. 확정은 **타임존이 명시된 다른
컬럼과 31,567행을 대조**해서 났다 — `paid_class_reminder_log.class_start_at` 28,784/28,791 일치,
`phase1_lifecycle.trial_scheduled_at` 2,776/2,776 일치, **KST 가정은 양쪽 0건**.
naive 컬럼의 존은 스키마에 안 적혀 있으므로, 데이터로만 확정된다.

## 이 노트가 나온 작업
- 브랜치 `backend` (2026-07-26), 커밋 `685d8b2`
- `docs/backend/workflow.ts` — `KST Day Window` Set 노드 추가 · `Query Today`/`Query Detail` 시각 식 교체
- 검증: n8n 실행 `1181101` 로 실제 행까지 확인(KST 오늘 07:00·07:30·08:00 시작 trial).
  인덱스 수치(6.85ms / 27ms)는 이전 세션의 `EXPLAIN ANALYZE` 실측값이다.
