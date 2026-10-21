import { cn } from "@/lib/utils";
import type { DocumentRepository } from "@/src/modules/documents/document-repository/document.repository";

export type SaveStatus = ReturnType<DocumentRepository["getSnapshot"]>;
export type DotState = "here" | "working" | "retrying" | "failed";

export function dotOf(status: SaveStatus | undefined): DotState | null {
  if (!status || status === "saved" || status === "paused") return null;
  if (status === "retrying") return "retrying";
  if (status === "error" || status === "conflict") return "failed";
  return "working";
}

export function SaveDot({ state, className }: { state: DotState; className?: string }) {
  return <span aria-hidden="true" className={cn("fd-dot", className)} data-state={state} />;
}
