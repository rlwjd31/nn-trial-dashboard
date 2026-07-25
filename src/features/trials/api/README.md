# features/trials/api

브라우저 → **자기 도메인** `/api/*` 호출 함수 (클라이언트 사이드).

- 예정: `getTrials()`, `getTrialDetail(id)`, `patchPreTrialCallCheck(...)`.
- 여기서 부르는 것은 Next Route Handler(`app/api/trials/**`)이며, n8n·토큰은
  절대 다루지 않는다 (서버 경계 밖). n8n 프록시는 `@/lib/n8n` + `app/api`.
- 순수 fetch 래퍼만. 캐싱/상태는 `../hooks`가 담당.

자세한 규칙: [docs/ARCHITECTURE.md](../../../../docs/ARCHITECTURE.md)
