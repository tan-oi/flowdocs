import type { DocMeta } from "@/src/modules/documents/documents-manager/document.manager";

const WEEK = 7 * 24 * 60 * 60 * 1000;

export function groupDocuments(
  docs: readonly Readonly<DocMeta>[],
  visible: number,
  now: number
) {
  const shown = [...docs]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, visible);
  const isRecent = (doc: Readonly<DocMeta>) =>
    now - new Date(doc.updatedAt).getTime() < WEEK;
  return {
    recent: shown.filter(isRecent),
    older: shown.filter((doc) => !isRecent(doc)),
  };
}
