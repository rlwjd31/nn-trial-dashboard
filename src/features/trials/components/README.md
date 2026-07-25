# features/trials/components

trials 도메인 **전용** 프레젠테이션 컴포넌트.

- 예정: `TrialTable`, `TrialRow`, `StatCard`, `TrialDetailSheet`, `PreTrialCallCheckbox`
- 원자 UI(`Button`, `Card`, `Table`, `Badge` 등)는 여기가 아니라 `@/components/ui`.
- 데이터는 `../hooks`에서 받아 props로 주입 (컴포넌트에서 직접 fetch 금지).

자세한 규칙: [docs/ARCHITECTURE.md](../../../../docs/ARCHITECTURE.md)
