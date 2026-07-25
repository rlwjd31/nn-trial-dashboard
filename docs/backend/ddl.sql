-- Trial Dashboard 전용 상태 테이블 (pre-trial call 진행 · 학생 추가정보 메모)
-- 스키마: automation. public 원천 테이블은 SELECT 전용이며 절대 변경하지 않는다.
-- ⚠ DB 소유자가 직접 실행. n8n Trials API 워크플로우는 이 테이블이 존재한다고 가정한다.
-- 멱등(IF NOT EXISTS): 기존 테이블·데이터에 영향 없음.
--
-- ── 라이브 검증 2026-07-25 (DB naonow · PostgreSQL 15.17 · 접속 역할 automation_coupons) ──
-- · automation.trial_dashboard_state 아직 없음 (to_regclass IS NULL).
-- · public."Lessons".id = integer, PK(id), DEFAULT nextval('"Lessons_id_seq"').
--   행 267,266 / isTrial 행 4,419 / id 범위 33327..270341 → INTEGER 충분(soft-delete 컬럼 없음).
-- · automation 스키마 owner = naonower 이지만, 기존 41개 테이블 owner 는 전부 automation_coupons.
-- · automation_coupons 권한: automation USAGE=true, CREATE=true → 이 역할로 직접 생성 가능.
--
-- 실행 역할 권장: automation_coupons (n8n Postgres 자격증명 TYGrEaGEtyIrZUHe 와 동일 역할).
--   기존 automation 테이블 소유자와 일치하고, 아래 GRANT 없이도 워크플로우가 바로 쓴다.
--
-- ⚠ public."Lessons" 로의 FOREIGN KEY 는 두지 않는다 — 근거 2가지:
--   1) automation_coupons 는 public."Lessons" 에 REFERENCES 권한이 없다(라이브 확인: false).
--      FK 를 넣으면 이 역할로 실행할 때 permission denied 로 DDL 전체가 실패한다.
--   2) automation 스키마의 어떤 테이블도 public 로 FK 를 걸지 않는다. lesson_id·student_id 를
--      맨 integer 로만 보관하는 것이 이 스키마의 확립된 관례다
--      (trial_reminder_log · pre_trial_survey_logs · paid_class_reminder_jobs · survey_logs …).
--   대가: Lessons 행이 하드 삭제되면 고아 행이 남는다(파일 하단 정리 쿼리 참고).
--
-- 타입 컨벤션: automation 스키마는 snake_case + `timestamp with time zone`(정밀도 수식 없음).
--   → TIMESTAMPTZ 를 쓰고 (3) 은 붙이지 않는다. 배열 컬럼도 이 스키마에 선례가 있다
--     (kakao_templates_snapshot.variables text[] · paid_class_reminder_log.message_send_log_ids bigint[]).

CREATE TABLE IF NOT EXISTS automation.trial_dashboard_state (
    lesson_id              INTEGER PRIMARY KEY,  -- = public."Lessons".id = API 의 trial_id. FK 없음(위 주석).
    pre_trial_call_checks  BOOLEAN[] NOT NULL DEFAULT ARRAY[false, false, false],  -- [1차,2차,3차]
    sales_note             TEXT,                                 -- 학생 관련 추가정보 / 세일즈 메모
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trial_dashboard_state_checks_len3
        CHECK (array_length(pre_trial_call_checks, 1) = 3)        -- stage 범위 이탈 시 조용히 늘어나는 것 차단
);

-- DDL 을 automation_coupons 이외의 역할(naonower·postgres)로 실행했다면 이 GRANT 가 필요하다.
-- automation_coupons 로 실행했다면 소유자라 불필요하지만, 재실행해도 무해하다.
GRANT SELECT, INSERT, UPDATE, DELETE ON automation.trial_dashboard_state TO automation_coupons;

-- 작성자(누가) 추적 안 함: sales rep 2명 + 로그인 없음(토큰 1겹) → over-engineering 이므로 제외.
-- 화면의 sales rep 표시는 trial 배정 rep(CallQueues 기준 sales_rep_name)로 이미 제공됨.

-- lesson_id = Lessons.id(= trial_id). trial 1건당 1행.
-- pre_trial_call_checks: 길이 3 boolean 배열. index 1..3 = n차 pre-trial call 완료 여부(Postgres 배열은 1-base).
--   단건 갱신: UPDATE ... SET pre_trial_call_checks[<stage>] = <bool>.
--   stage 는 API(route handler)에서 1|2|3 로 검증되고, 위 CHECK 가 2차 방어선이다.

-- 고아 행 정리(선택, FK 를 두지 않은 대가). 필요 시 수동 또는 주기 실행:
--   DELETE FROM automation.trial_dashboard_state d
--    WHERE NOT EXISTS (SELECT 1 FROM public."Lessons" l WHERE l.id = d.lesson_id);

-- 롤백: DROP TABLE automation.trial_dashboard_state;
