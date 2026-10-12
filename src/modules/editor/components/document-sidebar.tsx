"use client";

import Link from "next/link";
import DocumentRename from "./document-rename";
import {
  useDocumentManager,
  useDocumentManagerSnapshot,
} from "../../documents/documents-manager/document-manager-provider";

const statusLabels = {
  saved: "Saved",
  saving: "Saving…",
  creating: "Creating…",
  unsaved: "Unsaved changes",
  error: "Couldn’t save",
};

export default function DocumentSidebar() {
  const manager = useDocumentManager();
  const { recentDocuments, activeRepository, repositories } =
    useDocumentManagerSnapshot();

  return (
    <aside className="flow-sidebar" aria-label="Workspace sidebar">
      <Link className="flow-sidebar__brand" href="/">
        FlowDocs
      </Link>
      <Link className="flow-sidebar__new" href="/document/new" scroll={false}>
        <span aria-hidden="true">+</span> New document
      </Link>
      <nav aria-labelledby="recent-documents-heading">
        <h2 id="recent-documents-heading" className="flow-sidebar__heading">
          Recent documents
        </h2>
        <ul className="flow-sidebar__list">
          {activeRepository && !activeRepository.documentId && (
            <li>
              <span className="flow-sidebar__document" aria-current="page">
                <span className="flow-sidebar__title">{activeRepository.title}</span>
                <span className="flow-sidebar__status" data-status={activeRepository.getSnapshot()}>
                  {statusLabels[activeRepository.getSnapshot()]}
                </span>
              </span>
            </li>
          )}
          {recentDocuments.map((document) => {
            const repository = repositories.find((repo) => repo.documentId === document.id);
            const status = repository?.getSnapshot();
            return (
              <li key={document.id} className="flow-sidebar__row">
                <Link
                  className="flow-sidebar__document"
                  href={`/document/${document.id}`}
                  prefetch={false}
                  scroll={false}
                  onNavigate={(event) => {
                    const cached = manager.getRepositoryByDocumentId(document.id);
                    if (!cached) return;

                    event.preventDefault();
                    const href = `/document/${document.id}`;
                    if (window.location.pathname !== href) {
                      window.history.pushState(null, "", href);
                    }
                    manager.activateRepository(cached);
                  }}
                  aria-current={activeRepository?.documentId === document.id ? "page" : undefined}
                >
                  <span className="flow-sidebar__title">{document.title}</span>
                  {status && (
                    <span className="flow-sidebar__status" data-status={status}>
                      {statusLabels[status]}
                    </span>
                  )}
                </Link>
                <DocumentRename id={document.id} title={document.title} />
              </li>
            );
          })}
        </ul>
        {recentDocuments.length === 0 && !activeRepository && (
          <p className="flow-sidebar__empty">Create a document to start writing.</p>
        )}
      </nav>
    </aside>
  );
}
