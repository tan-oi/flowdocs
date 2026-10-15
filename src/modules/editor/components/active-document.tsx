import { useEffect, useSyncExternalStore } from "react";
import { DocumentRepository } from "../../documents/document-repository/document.repository";
import Link from "next/link";
import DocumentEditor from "./document-editor";

export default function ActiveDocument({
  documentRepository,
}: {
  documentRepository: DocumentRepository;
}) {
  const status = useSyncExternalStore(
    documentRepository.subscribe,
    documentRepository.getSnapshot,
    documentRepository.getSnapshot
  );
  const documentId = documentRepository.documentId;

  useEffect(() => {
    if (!documentId) return;
    if (documentRepository.isNew)
      window.history.replaceState(null, "", `/document/${documentId}`);
  }, [documentId, documentRepository]);

  return (
    <main className="flow-document">
      <div className="flow-document__topline">
        <span className="flow-document__workspace">My workspace</span>
        {status !== "paused" && (
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
        )}
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
