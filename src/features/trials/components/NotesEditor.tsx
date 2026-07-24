"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// MDXEditor 는 클라 전용 → dynamic(ssr:false). 스펙: docs/ptc-call-notes.md
const Editor = dynamic(() => import("./InitializedMDXEditor"), { ssr: false });

interface Props {
  /** 메모를 trial 단위로 구분·저장하기 위한 키 */
  trialId: string | null;
}

/**
 * PTC 콜 메모 — 마크다운을 입력하는 즉시 그 자리에서 렌더(WYSIWYG).
 * TODO: 현재 저장은 trial별 localStorage 임시 방식. 확정 후 n8n
 *       CallQueueNotes(type='sales') 엔드포인트로 교체(docs/ptc-call-notes.md §4).
 */
export function NotesEditor({ trialId }: Props) {
  const storageKey = trialId ? `ptc-note:${trialId}` : null;
  const [initial, setInitial] = useState<string | null>(null);

  // trial 전환 시 해당 메모 로드 (에디터는 key 로 재초기화)
  useEffect(() => {
    setInitial(storageKey ? (localStorage.getItem(storageKey) ?? "") : "");
  }, [storageKey]);

  function handleChange(markdown: string) {
    if (storageKey) localStorage.setItem(storageKey, markdown);
  }

  return (
    <section className="mt-2">
      <p className="mb-2 text-sm font-medium text-foreground">PTC 콜 메모</p>
      <div className="ptc-notes overflow-hidden rounded-xl border border-glass-edge bg-black/20">
        {initial !== null && (
          <Editor
            key={trialId ?? "none"}
            markdown={initial}
            onChange={handleChange}
            className="dark-theme"
            contentEditableClassName="min-h-[220px]"
            placeholder="마크다운으로 상담 내용을 기록… (예: # 제목, - 목록, **굵게**)"
          />
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground/70">
        입력 즉시 렌더(WYSIWYG) · (임시: 이 브라우저에 저장)
      </p>
    </section>
  );
}
