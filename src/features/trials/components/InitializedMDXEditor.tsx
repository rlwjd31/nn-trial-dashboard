"use client";

import "@mdxeditor/editor/style.css";
import type { ForwardedRef } from "react";
import {
  headingsPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods,
  type MDXEditorProps,
  quotePlugin,
  thematicBreakPlugin,
} from "@mdxeditor/editor";

// MDXEditor 초기화. window 참조 → NotesEditor 에서 dynamic(ssr:false)로 로드한다.
// markdownShortcutPlugin 이 "# " → 헤딩, "- " → 목록 등 입력 즉시(WYSIWYG) 변환을 담당.
export default function InitializedMDXEditor({
  editorRef,
  ...props
}: { editorRef?: ForwardedRef<MDXEditorMethods> } & MDXEditorProps) {
  return (
    <MDXEditor
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        linkPlugin(),
        markdownShortcutPlugin(),
      ]}
      {...props}
      ref={editorRef}
    />
  );
}
