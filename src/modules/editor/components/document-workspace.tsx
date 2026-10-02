"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { DocumentRepository } from "../../documents/document-repository/document.repository";
import type { Document } from "../../documents/document.types";
import ActiveDocument from "./active-document";

const DocumentRepositoryContext = createContext<
  ((document?: Document) => void) | null
>(null);

export function DocumentWorkspace({ children }: { children: React.ReactNode }) {
  const [documentRepository, setDocumentRepository] =
    useState<DocumentRepository | null>(null);
  const openDocument = useCallback((document?: Document) => {
    setDocumentRepository((current) =>
      current && current.documentId === (document?.id ?? null)
        ? current
        : new DocumentRepository(document)
    );
  }, []);

  return (
    <DocumentRepositoryContext.Provider value={openDocument}>
      {children}
      {documentRepository && (
        <ActiveDocument
          key={documentRepository.localKey}
          documentRepository={documentRepository}
        />
      )}
    </DocumentRepositoryContext.Provider>
  );
}

export function DocumentRouteSync({ document }: { document?: Document }) {
  const openDocument = useContext(DocumentRepositoryContext);
  if (!openDocument) throw new Error("DocumentWorkspace is missing");
  useEffect(() => {
    openDocument(document);
  }, [openDocument, document]);
  return null;
}
