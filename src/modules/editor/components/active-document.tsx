import { useEffect, useSyncExternalStore } from "react";
import { DocumentRepository } from "@/src/modules/documents/document-repository/document.repository";
import DocumentEditor from "./document-editor";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function ActiveDocument({
  documentRepository,
}: {
  documentRepository: DocumentRepository;
}) {
  const documentId = useSyncExternalStore(
    documentRepository.subscribe,
    documentRepository.getDocumentId,
    documentRepository.getDocumentId
  );

  useEffect(() => {
    if (!documentId) return;
    if (documentRepository.isNew)
      window.history.replaceState(null, "", `/document/${documentId}`);
  }, [documentId, documentRepository]);

  return (
    <div className="relative min-w-0 flex-1">
      <SidebarTrigger
        title="Sidebar ⌘B"
        className="absolute top-4 left-4 text-quiet hover:text-foreground"
      />
      <div className="mx-auto mt-25 mb-25 w-[min(100%-80px,680px)] max-[600px]:mt-16 max-[600px]:w-[calc(100%-44px)]">
        <DocumentEditor repo={documentRepository} />
      </div>
    </div>
  );
}
