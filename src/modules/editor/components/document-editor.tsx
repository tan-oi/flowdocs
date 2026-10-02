"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Content } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { DocumentRepository } from "@/src/modules/documents/document-repository/document.repository";

export default function DocumentEditor({ repo }: { repo: DocumentRepository }) {
  useEffect(() => {
    void repo.saveNow().catch(console.error);
    return () => repo.close();
  }, [repo]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: repo.initialContent as Content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => repo.updateState(editor.getJSON()),
  });

  return (
    <>
      <EditorContent editor={editor} />
    </>
  );
}
