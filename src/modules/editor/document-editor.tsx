"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent, type Content } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { DocumentRepository } from "@/src/modules/documents/document.repository";
import type { Document } from "@/src/modules/documents/document.types";

export function DocumentEditor({ document }: { document: Document }) {
  const [repo] = useState(() => new DocumentRepository(document));

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
      <EditorContent editor={editor} />;
    </>
  );
}
