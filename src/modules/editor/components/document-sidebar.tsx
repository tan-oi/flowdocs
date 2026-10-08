"use client";

import Link from "next/link";
import { useDocumentManagerSnapshot } from "../../documents/documents-manager/document-manager-provider";

const statusLabels = {
  saved: "Saved",
  saving: "Saving…",
  creating: "Creating…",
  unsaved: "Unsaved changes",
  error: "Couldn’t save",
};

export default function DocumentSidebar() {
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
              <li key={document.id}>
                <Link
                  className="flow-sidebar__document"
                  href={`/document/${document.id}`}
                  scroll={false}
                  aria-current={activeRepository?.documentId === document.id ? "page" : undefined}
                >
                  <span className="flow-sidebar__title">{document.title}</span>
                  {status && (
                    <span className="flow-sidebar__status" data-status={status}>
                      {statusLabels[status]}
                    </span>
                  )}
                </Link>
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
