"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDocumentManager } from "../../documents/documents-manager/document-manager-provider";

export default function DocumentDelete({ id, title }: { id: string; title: string }) {
  const manager = useDocumentManager();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        className="flow-sidebar__delete-button"
        aria-label={`Delete ${title}`}
        disabled={pending}
        onClick={() => {
          if (pending) return;
          startTransition(async () => {
            setError(null);
            const result = await manager.deleteDocument(id);
            if (!result.ok) {
              setError(result.error.message);
              return;
            }
            if (window.location.pathname !== `/document/${id}`) return;
            const next = manager.getSnapshot().recentDocuments[0];
            const cached = next ? manager.getRepositoryByDocumentId(next.id) : null;
            const href = next ? `/document/${next.id}` : "/document/new";
            if (cached) {
              window.history.replaceState(null, "", href);
              manager.activateRepository(cached);
            } else {
              router.replace(href, { scroll: false });
            }
          });
        }}
      >
        {pending ? "Deleting…" : error ? "Retry delete" : "Delete"}
      </button>
      {error && (
        <div className="flow-sidebar__delete-error" role="alert">
          <p>{error}</p>
          <div className="flow-sidebar__rename-actions">
            <button type="button" onClick={() => setError(null)}>Dismiss</button>
          </div>
        </div>
      )}
    </>
  );
}
