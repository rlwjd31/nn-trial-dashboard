export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Today&apos;s Trials
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Sales 팀 내부용 대시보드 · 스캐폴드 준비 완료
      </p>

      <section className="mt-8 rounded-lg border border-gray-200 p-5 text-sm leading-6">
        <p className="font-medium">다음 단계 (PRD 마일스톤 3~5)</p>
        <ul className="mt-2 list-disc pl-5 text-gray-600">
          <li>목록 테이블 + 대시보드 카드</li>
          <li>상세 패널 + Call queue 이동</li>
          <li>Pre-trial 체크 optimistic update</li>
        </ul>
        <p className="mt-4 text-gray-500">
          프록시 API 골격:{" "}
          <code className="rounded bg-gray-100 px-1">/api/trials</code>,{" "}
          <code className="rounded bg-gray-100 px-1">/api/trials/[id]</code>,{" "}
          <code className="rounded bg-gray-100 px-1">/api/trials/precheck</code>
        </p>
      </section>
    </main>
  );
}
