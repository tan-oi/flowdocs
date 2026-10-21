"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { DocumentRepository } from "@/src/modules/documents/document-repository/document.repository";
import type { Document } from "@/src/modules/documents/document.types";
import ActiveDocument from "./active-document";
import DocumentSidebar from "./sidebar/document-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  useDocumentManager,
  useDocumentManagerSnapshot,
} from "@/src/modules/documents/documents-manager/document-manager-provider";

const DocumentRepositoryContext = createContext<
  ((document?: Document, documentId?: string) => boolean) | null
>(null);

export function DocumentWorkspace({
  children,
  sidebarOpen,
}: {
  children: React.ReactNode;
  sidebarOpen: boolean;
}) {
  const manager = useDocumentManager();
  const { activeRepository: documentRepository } = useDocumentManagerSnapshot();

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      const pending = manager.getSnapshot().repositories.some(
        (repository) => repository.getSnapshot() !== "saved"
      );
      if (!pending) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [manager]);

  const openDocument = useCallback(
    (document?: Document, documentId?: string) => {
      const requestedId = documentId ?? document?.id ?? null;
      if (requestedId && manager.isDocumentUnavailable(requestedId)) return false;
      const current = manager.activeRepository;
      if (current && current.documentId === requestedId) return true;

      const cached = requestedId
        ? manager.getCachedRepository(requestedId)
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
      <SidebarProvider
        defaultOpen={sidebarOpen}
        style={{ "--sidebar-width": "274px" } as React.CSSProperties}
      >
        <DocumentSidebar />
        <SidebarInset>
          {documentRepository && (
            <ActiveDocument
              key={documentRepository.localKey}
              documentRepository={documentRepository}
            />
          )}
        </SidebarInset>
      </SidebarProvider>
    </DocumentRepositoryContext.Provider>
  );
}

export function DocumentRouteSync({ document }: { document?: Document }) {
  const manager = useDocumentManager();
  const openDocument = useContext(DocumentRepositoryContext);
  const pathname = usePathname();
  const router = useRouter();
  if (!openDocument) throw new Error("DocumentWorkspace is missing");
  useEffect(() => {
    const documentId = pathname.match(/^\/document\/([^/]+)\/?$/)?.[1];
    if (!documentId) return;
    if (manager.isDocumentUnavailable(documentId)) {
      const next = manager.getSnapshot().recentDocuments[0];
      router.replace(next ? `/document/${next.id}` : "/document/new", { scroll: false });
      return;
    }

    if (documentId === "new") {
      openDocument();
    } else {
      const opened = openDocument(
        document?.id === documentId ? document : undefined,
        documentId
      );
      if (!opened) router.replace(pathname, { scroll: false });
    }
  }, [openDocument, document, pathname, router, manager]);
  return null;
}
