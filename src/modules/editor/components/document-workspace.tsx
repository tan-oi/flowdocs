"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { DocumentRepository } from "../../documents/document-repository/document.repository";
import type { Document } from "../../documents/document.types";
import ActiveDocument from "./active-document";
import DocumentSidebar from "./document-sidebar";
import {
  useDocumentManager,
  useDocumentManagerSnapshot,
} from "../../documents/documents-manager/document-manager-provider";

const DocumentRepositoryContext = createContext<
  ((document?: Document, documentId?: string) => boolean) | null
>(null);

export function DocumentWorkspace({ children }: { children: React.ReactNode }) {
  const manager = useDocumentManager();
  const { activeRepository: documentRepository } = useDocumentManagerSnapshot();

  const openDocument = useCallback(
    (document?: Document, documentId?: string) => {
      const requestedId = documentId ?? document?.id ?? null;
      const current = manager.activeRepository;
      if (current && current.documentId === requestedId) return true;

      const cached = requestedId
        ? manager.getRepositoryByDocumentId(requestedId)
        : null;
      if (requestedId && !cached && !document) return false;

      const repository = cached ?? new DocumentRepository(document);

      if (!cached) manager.registerRepository(repository);

      manager.activateRepository(repository);
      return true;
    },
    [manager]
  );

  return (
    <DocumentRepositoryContext.Provider value={openDocument}>
      {children}
      <div className="flow-workspace">
        <DocumentSidebar />
        {documentRepository && (
          <ActiveDocument
            key={documentRepository.localKey}
            documentRepository={documentRepository}
          />
        )}
      </div>
    </DocumentRepositoryContext.Provider>
  );
}

export function DocumentRouteSync({ document }: { document?: Document }) {
  const openDocument = useContext(DocumentRepositoryContext);
  const pathname = usePathname();
  const router = useRouter();
  if (!openDocument) throw new Error("DocumentWorkspace is missing");
  useEffect(() => {
    const documentId = pathname.match(/^\/document\/([^/]+)\/?$/)?.[1];
    if (!documentId) return;

    if (documentId === "new") {
      openDocument();
    } else {
      const opened = openDocument(
        document?.id === documentId ? document : undefined,
        documentId
      );
      if (!opened) router.replace(pathname, { scroll: false });
    }
  }, [openDocument, document, pathname, router]);
  return null;
}
