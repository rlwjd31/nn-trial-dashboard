"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { useNoteMutation } from "../hooks/useNoteMutation";

// MDXEditor 는 클라 전용 → dynamic(ssr:false). 스펙: ../docs/ptc-call-notes.md
const Editor = dynamic(() => import("./InitializedMDXEditor"), { ssr: false });

/**
 * 타이핑이 멈춘 뒤 저장까지 기다리는 시간.
 * MDXEditor 의 onChange 는 스로틀되지 않아(키 입력마다 발생) 디바운스가 필수다.
 * 저장 1회 = n8n 워크플로우 실행 1건이므로 짧게 두지 않는다 —
 * 통화 중 끊어 쓰는 패턴에서 "멈춤마다 저장"이 수십 건씩 쌓인다.
 */
const SAVE_DEBOUNCE_MS = 3000;

interface Props {
  trialId: string;
  /** 상세 응답의 sales_note (미기록이면 null) */
  note: string | null;
}

/**
 * PTC 콜 메모 — 마크다운을 입력하는 즉시 그 자리에서 렌더(WYSIWYG).
 * 저장은 PATCH /api/trials/note → n8n `sales_note` (자동 저장, optimistic).
 *
 * MDXEditor 의 `markdown` 은 마운트 시점에만 읽히므로, optimistic update 로
 * 갱신된 note 가 되돌아와도 편집 중 내용이 덮이지 않는다. trial 전환은
 * 부모(TrialDetailSheet)의 key 재마운트로 처리한다.
 */
export function NotesEditor({ trialId, note }: Props) {
  const { mutate, isPending, isError } = useNoteMutation();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 디바운스 대기 중인(아직 저장 요청을 보내지 않은) 최신 본문
  const pendingRef = useRef<string | null>(null);
  // 이미 서버로 보낸 본문 — 같은 내용을 다시 보내지 않기 위한 기준(dirty 체크)
  const savedRef = useRef(note ?? "");
  // 언마운트 cleanup 에서 최신 mutate 를 읽기 위한 통로 (render 중에는 쓰지 않는다)
  const saveRef = useRef<((markdown: string) => void) | null>(null);

  useEffect(() => {
    saveRef.current = (markdown: string) =>
      mutate({ trial_id: trialId, note: markdown });
  }, [mutate, trialId]);

  // 디바운스 대기 중 언마운트(시트 닫기·trial 전환)되면 마지막 입력이 유실되므로
  // 그 시점에 흘려보낸다. 언마운트 후에도 mutation 은 정상 실행된다(캐시 갱신·실패 토스트 포함).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const markdown = pendingRef.current;
      pendingRef.current = null;
      if (markdown !== null) saveRef.current?.(markdown);
    };
  }, []);

  function handleChange(markdown: string, initialMarkdownNormalize: boolean) {
    // 초기 마크다운 정규화로 인한 onChange → 사용자 입력이 아니므로 저장하지 않는다.
    // 대신 dirty 비교 기준을 이 정규화된 본문으로 맞춘다. 에디터의 직렬화 결과는
    // 원본과 공백·불릿 기호가 다를 수 있어, 원본을 기준으로 두면 "쓴 것을 되돌려도
    // 다르다"고 판정되어 불필요한 저장이 나간다.
    if (initialMarkdownNormalize) {
      savedRef.current = markdown;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;

    // 이미 보낸 본문과 같아졌으면(예: 한 글자 썼다가 지움) 보낼 것이 없다.
    if (markdown === savedRef.current) {
      pendingRef.current = null;
      return;
    }

    pendingRef.current = markdown;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      pendingRef.current = null;
      savedRef.current = markdown;
      saveRef.current?.(markdown);
    }, SAVE_DEBOUNCE_MS);
  }

  return (
    <section className="mt-2">
      <p className="mb-2 text-sm font-medium text-foreground">PTC 콜 메모</p>
      <div className="ptc-notes overflow-hidden rounded-xl border border-glass-edge bg-black/20">
        <Editor
          markdown={note ?? ""}
          onChange={handleChange}
          className="dark-theme"
          contentEditableClassName="min-h-[220px]"
          placeholder="마크다운으로 상담 내용을 기록… (예: # 제목, - 목록, **굵게**)"
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground/70">
        입력 즉시 렌더(WYSIWYG) ·{" "}
        {isError ? (
          <span className="text-destructive">저장 실패</span>
        ) : isPending ? (
          "저장 중…"
        ) : (
          "자동 저장"
        )}
      </p>
    </section>
  );
}
