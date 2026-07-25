-- Trial Dashboard 전용 상태 테이블 (pre-trial call 진행 · 학생 추가정보 메모)
-- 스키마: automation (DB 소유자가 직접 생성). trials 원천 테이블은 public.
-- 네이밍: automation 스키마의 고전적 컨벤션 = snake_case (예: automation.new_user_fomo_outbox).
-- ⚠ DB 소유자가 직접 실행. n8n Trials API 워크플로우는 이 테이블이 존재한다고 가정한다.
-- 멱등(IF NOT EXISTS): 기존 테이블·데이터에 영향 없음.

CREATE TABLE IF NOT EXISTS automation.trial_dashboard_state (
    lesson_id        INTEGER PRIMARY KEY
                     REFERENCES public."Lessons"(id) ON UPDATE CASCADE ON DELETE CASCADE,
    pre_trial_calls  BOOLEAN[] NOT NULL DEFAULT ARRAY[false, false, false],  -- [1차,2차,3차] pre-trial call 진행
    sales_note       TEXT,                                                   -- 학생 관련 추가정보 / 세일즈 메모
    updated_by       INTEGER REFERENCES public."Users"(id),
    updated_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- lesson_id = Lessons.id(= trial_id). trial 1건당 1행.
-- pre_trial_calls: 길이 3 boolean 배열. index 1..3 = n차 pre-trial call 완료 여부(Postgres 배열은 1-base).
--   단건 갱신: UPDATE ... SET pre_trial_calls[<stage>] = <bool>.
-- 롤백: DROP TABLE automation.trial_dashboard_state;
