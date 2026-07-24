# features/trials/lib

trials 도메인 전용 **순수 함수** (부수효과 없음).

- 예정: 상단 카드 수치 집계(`aggregateStats`), trial_time 포맷, tier/status 매핑 등.
- React·fetch 의존 없는 순수 로직만 → 테스트 쉬움.
- 여러 도메인이 공용으로 쓰게 되면 그때 `@/lib`로 승격 (미리 만들지 않음).

자세한 규칙: [docs/ARCHITECTURE.md](../../../../docs/ARCHITECTURE.md)
