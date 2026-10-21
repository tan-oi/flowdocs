"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDocumentManager } from "@/src/modules/documents/documents-manager/document-manager-provider";

export function useDocumentNavigation() {
  const manager = useDocumentManager();
  const router = useRouter();

  const showCached = useCallback(
    (documentId: string, history: "push" | "replace") => {
      const cached = manager.getCachedRepository(documentId);
      if (!cached) return false;
      const href = `/document/${documentId}`;
      if (window.location.pathname !== href) {
        if (history === "push") window.history.pushState(null, "", href);
        else window.history.replaceState(null, "", href);
      }
      manager.activateRepository(cached);
      return true;
    },
    [manager]
  );

  const leaveDeleted = useCallback(
    (documentId: string) => {
      if (window.location.pathname !== `/document/${documentId}`) return;
      const next = manager.getSnapshot().recentDocuments[0];
      if (next && showCached(next.id, "replace")) return;
      router.replace(next ? `/document/${next.id}` : "/document/new", { scroll: false });
    },
    [manager, router, showCached]
  );

  return { showCached, leaveDeleted };
}
