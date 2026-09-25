"use client";

import { useEffect } from "react";

import { useDocumentManager } from "./document-manager-provider";
import type { DocMeta } from "./document.manager";

export function OpenedDocument({ id, title, updatedAt }: DocMeta) {
  const manager = useDocumentManager();

  useEffect(() => {
    manager.openDocument({ id, title, updatedAt });
  }, [manager, id, title, updatedAt]);

  return null;
}
