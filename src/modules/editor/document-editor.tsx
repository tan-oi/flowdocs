"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useEditor, EditorContent, type Content } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { DocumentRepository } from "@/src/modules/documents/document-repository/document.repository";
import type { Document } from "@/src/modules/documents/document.types";

export function DocumentEditor({ document }: { document: Document }) {
  const [repo] = useState(() => new DocumentRepository(document));
  const status = useSyncExternalStore(
    repo.subscribe,
    repo.getSnapshot,
    repo.getSnapshot
  );
  useEffect(() => {
    return () => repo.close();
  }, [repo]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: document.content as Content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => repo.updateState(editor.getJSON()),
  });

  return (
    <>
      <h1 className="text-orange-500 text-5xl">{status}</h1>
      <EditorContent editor={editor} />
    </>
  );
}
