import { updateContent } from "./index";

export type SaveResult =
  | { ok: true; data: { revision: number } }
  | { ok: false; error: { code: "conflict" | "internal"; message: string } };

export async function udpateContent(
  documentId: string,
  version: number,
  content: unknown
): Promise<SaveResult> {
  //check auth
  const revisedVersion = await updateContent(documentId, content, version);

  if (revisedVersion === null) {
    return {
      ok: false,
      error: { code: "conflict", message: "Document changed since it was opened" },
    };
  }

  return { ok: true, data: { revision: revisedVersion } };
}
