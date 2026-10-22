"use client";

import { useEffect } from "react";
import { DocumentRepository } from "@/src/modules/documents/document-repository/document.repository";
import { useEditorApi } from "@/src/modules/editor/api/use-editor-api";
import { EditorApiProvider } from "@/src/modules/editor/api/editor-api-context";

export default function DocumentEditor({ repo }: { repo: DocumentRepository }) {
  useEffect(() => {
    void repo.saveNow().catch(console.error);
    return () => repo.close();
  }, [repo]);

  const api = useEditorApi(repo);
  if (!api) return null;

  return (
    <EditorApiProvider value={api}>
      <api.Content />
    </EditorApiProvider>
  );
}
