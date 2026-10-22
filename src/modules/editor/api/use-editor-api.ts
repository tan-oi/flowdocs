"use client";

import { useMemo } from "react";
import { useEditor, type Content } from "@tiptap/react";
import type { DocumentRepository } from "@/src/modules/documents/document-repository/document.repository";
import { editorExtensions } from "@/src/modules/editor/extensions";
import { EditorApi } from "./editor-api";

export function useEditorApi(repo: DocumentRepository): EditorApi | null {
  const editor = useEditor({
    extensions: editorExtensions,
    content: repo.content as Content,
    immediatelyRender: false,
    // ProseMirror attrs have a null prototype, which server actions silently drop; this makes them plain objects.
    onUpdate: ({ editor }) => repo.updateState(JSON.parse(JSON.stringify(editor.getJSON()))),
  });
  return useMemo(() => (editor ? new EditorApi(editor) : null), [editor]);
}
