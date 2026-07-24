// trials 도메인 쿼리 키 (오타·중복 방지용 단일 출처).
export const trialKeys = {
  all: ["trials"] as const,
  list: () => [...trialKeys.all, "list"] as const,
  detail: (id: string) => [...trialKeys.all, "detail", id] as const,
};
