import { useDocumentManager } from "../../documents/documents-manager/document-manager-provider";
import { useEffect, useSyncExternalStore } from "react";
import { DocumentRepository } from "../../documents/document-repository/document.repository";
import Link from "next/link";
import DocumentEditor from "./document-editor";
import { browser } from "react-dom";

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
    <main className="flow-document">
      <div className="flow-document__topline">
        <span className="flow-document__workspace">My workspace</span>
        <span className="flow-document__separator" aria-hidden="true">
          /
        </span>
        <span className="flow-document__current">
          {documentRepository.title}
        </span>
        <span
          className="flow-document__status"
          data-status={status}
          role="status"
        >
          <i aria-hidden="true" />
          {
            {
              saved: "All changes saved",
              saving: "Saving…",
              creating: "Creating…",
              unsaved: "Unsaved changes",
              error: "Couldn’t save",
            }[status]
          }
        </span>
        <Link className="flow-document__new" href="/document/new">
          <span aria-hidden="true">+</span> New document
        </Link>
      </div>
      <div className="flow-document__body">
        <DocumentEditor repo={documentRepository} />
      </div>
    </main>
  );
}
