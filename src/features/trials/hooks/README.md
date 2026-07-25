# features/trials/hooks

trials 도메인의 TanStack Query 훅 (서버 상태).

- 예정: `useTrials`(목록), `useTrialDetail`(상세), `usePreTrialCallCheckMutation`(optimistic).
- fetch 자체는 `../api`에 위임하고, 여기서는 캐싱·optimistic update·롤백만 다룬다.
- `staleTime` 60s, `refetchOnWindowFocus` 는 PRD §5 참조.

자세한 규칙: [docs/ARCHITECTURE.md](../../../../docs/ARCHITECTURE.md)
