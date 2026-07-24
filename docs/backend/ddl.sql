-- Trial Dashboard 전용 상태 테이블 (precheck · call-done · 학생 추가정보 메모)
-- 검증 결과: automation_coupons 자격증명은 DB=naonow(프로덕션), public 스키마에
--   CREATE 가능하나 새 스키마(sales) 생성은 불가 → 테이블을 public 에 둔다.
-- ⚠ DB 소유자가 직접 실행. n8n Trials API 워크플로우는 이 테이블이 존재한다고 가정한다.
-- 멱등(IF NOT EXISTS): 기존 테이블·데이터에 영향 없음.

CREATE TABLE IF NOT EXISTS public."TrialDashboardState" (
    "lessonId"     INTEGER PRIMARY KEY
                   REFERENCES public."Lessons"(id) ON UPDATE CASCADE ON DELETE CASCADE,
    "precheck1"    BOOLEAN      NOT NULL DEFAULT FALSE,
    "precheck2"    BOOLEAN      NOT NULL DEFAULT FALSE,
    "precheck3"    BOOLEAN      NOT NULL DEFAULT FALSE,
    "preCallDone"  BOOLEAN      NOT NULL DEFAULT FALSE,
    "postCallDone" BOOLEAN      NOT NULL DEFAULT FALSE,
    "salesNote"    TEXT,                              -- 학생 관련 추가정보 / 세일즈 메모
    "updatedBy"    INTEGER REFERENCES public."Users"(id),
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 참고: precheck1/2/3 = pre-trial 체크(몇 번 했는지). pre/postCallDone 은 현재 수동 플래그로
--   두었으며 판정 로직 확정 시 채운다. 롤백은 DROP TABLE public."TrialDashboardState";
