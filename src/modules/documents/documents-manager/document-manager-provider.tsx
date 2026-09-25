"use client";

import { createContext, useContext, useState, useSyncExternalStore } from "react";

import { DocumentManager, type DocMeta } from "./document.manager";

const DocumentManagerContext = createContext<DocumentManager | null>(null);

export function DocumentManagerProvider({
  recentDocuments,
  children,
}: {
  recentDocuments: DocMeta[];
  children: React.ReactNode;
}) {
  const [manager] = useState(() => new DocumentManager(recentDocuments));

  return (
    <DocumentManagerContext.Provider value={manager}>
      {children}
    </DocumentManagerContext.Provider>
  );
}

export function useDocumentManager(): DocumentManager {
  const manager = useContext(DocumentManagerContext);
  if (!manager) {
    throw new Error("useDocumentManager requires DocumentManagerProvider");
  }
  return manager;
}

export function useDocumentManagerSnapshot() {
  const manager = useDocumentManager();
  return useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getSnapshot
  );
}
