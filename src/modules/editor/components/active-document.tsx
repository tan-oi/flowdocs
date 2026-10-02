import { useRouter } from "next/navigation";
import { useDocumentManager } from "../../documents/documents-manager/document-manager-provider";
import { useEffect, useSyncExternalStore } from "react";
import { DocumentRepository } from "../../documents/document-repository/document.repository";
import Link from "next/link";
import DocumentEditor from "./document-editor";

export default function ActiveDocument({
  documentRepository,
}: {
  documentRepository: DocumentRepository;
}) {
  const manager = useDocumentManager();
  const status = useSyncExternalStore(
    documentRepository.subscribe,
    documentRepository.getSnapshot,
    documentRepository.getSnapshot
  );
  const documentId = documentRepository.documentId;

  useEffect(() => {
    if (!documentId) return;
    manager.openDocument({
      id: documentId,
      title: documentRepository.title,
      updatedAt: new Date(),
    });
    if (documentRepository.isNew)
      window.history.replaceState(null, "", `/document/${documentId}`);
  }, [documentId, manager, documentRepository]);

  useEffect(() => {
    if (status === "saved") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  return (
    <div className="flow-workspace">
      <main className="flow-document">
        <div className="flow-document__topline">
          <span>My workspace / {documentRepository.title} </span>
          <Link href="/document/new">New document</Link>
          <p>Status : {status}</p>
        </div>
        <div className="flow-document__body">
          <DocumentEditor repo={documentRepository} />
        </div>
      </main>
    </div>
  );
}
