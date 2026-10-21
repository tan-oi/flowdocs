"use client";

import { useState } from "react";
import { SidebarInput } from "@/components/ui/sidebar";
import { useDocumentManager } from "@/src/modules/documents/documents-manager/document-manager-provider";
import type { DocMeta } from "@/src/modules/documents/documents-manager/document.manager";

export function RenameInput({ doc, onDone }: { doc: Readonly<DocMeta>; onDone: () => void }) {
  const manager = useDocumentManager();
  const [failed, setFailed] = useState(false);

  return (
    <form
      className="relative"
      onSubmit={async (event) => {
        event.preventDefault();
        const title = new FormData(event.currentTarget).get("title")?.toString().trim();
        if (!title || title === doc.title) return onDone();
        const result = await manager.renameDocument(title, doc.id);
        if (!result.ok) return setFailed(true);
        onDone();
      }}
    >
      <SidebarInput
        name="title"
        autoFocus
        defaultValue={doc.title}
        aria-label="Document title"
        aria-invalid={failed || undefined}
        onFocus={(event) => event.currentTarget.select()}
        onChange={() => setFailed(false)}
        onBlur={onDone}
        onKeyDown={(event) => {
          if (event.key === "Escape") onDone();
        }}
        className="relative z-2 rounded-md border-0 bg-secondary pr-3 pl-9 text-[14px] shadow-raised focus-visible:ring-0 md:text-[14px]"
      />
      {failed && <p className="px-7 pt-1 pb-1.5 text-[11px] text-destructive">Could not rename. Try again.</p>}
    </form>
  );
}
