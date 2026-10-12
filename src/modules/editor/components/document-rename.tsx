"use client";

import { useId, useState, useTransition } from "react";
import { renameDocumentAction } from "../../documents/server/actions";
import { useDocumentManager } from "../../documents/documents-manager/document-manager-provider";

export default function DocumentRename({ id, title }: { id: string; title: string }) {
  const manager = useDocumentManager();
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        className="flow-sidebar__rename-button"
        aria-label={`Rename ${title}`}
        onClick={() => {
          setDraftTitle(title);
          setError(null);
          setEditing(true);
        }}
      >
        Rename
      </button>
    );
  }

  return (
    <form
      className="flow-sidebar__rename-form"
      aria-label={`Rename ${title}`}
      aria-busy={pending}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) {
          event.preventDefault();
          setEditing(false);
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        startTransition(async () => {
          setError(null);
          try {
            const result = await renameDocumentAction(draftTitle, id);
            if (!result.ok) {
              setError(result.error.message);
              return;
            }
            manager.renameDocument(result.data.title, result.data.id, result.data.updatedAt);
            setEditing(false);
          } catch {
            setError("Could not rename document. Try again.");
          }
        });
      }}
    >
      <label htmlFor={inputId}>Document title</label>
      <input
        id={inputId}
        autoFocus
        value={draftTitle}
        disabled={pending}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        onChange={(event) => {
          setDraftTitle(event.target.value);
          setError(null);
        }}
      />
      {error && <p id={`${inputId}-error`} role="alert">{error}</p>}
      <div className="flow-sidebar__rename-actions">
        <button type="submit" disabled={pending}>{pending ? "Renaming…" : "Save"}</button>
        <button type="button" disabled={pending} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </form>
  );
}
