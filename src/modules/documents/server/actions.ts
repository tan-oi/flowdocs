"use server";

import { z } from "zod";
import { udpateContent } from "./document.service";
import type { SaveResult } from "./document.service";
import { create, deleteDocument, renameDocument } from "./drizzle.adapter";

const renameSchema = z.object({
  documentId: z.uuid("Invalid document ID"),
  title: z.string().trim().min(1, "Title cannot be empty"),
});

const deletionSchema = z.object({
  documentId: z.uuid("Invalid document ID"),
});

type RenameResult =
  | { ok: true; data: { id: string; title: string; updatedAt: Date } }
  | {
      ok: false;
      error: { code: "validation" | "not_found" | "internal"; message: string };
    };

export async function createDocumentAction() {
  return create("Untitled");
}

export async function renameDocumentAction(
  newTitle: string,
  documentId: string
): Promise<RenameResult> {
  const input = renameSchema.safeParse({ title: newTitle, documentId });
  if (!input.success) {
    return {
      ok: false,
      error: { code: "validation", message: input.error.issues[0].message },
    };
  }

  //check auth
  try {
    const document = await renameDocument(
      input.data.documentId,
      input.data.title
    );
    if (!document) {
      return {
        ok: false,
        error: { code: "not_found", message: "Document not found" },
      };
    }

    return {
      ok: true,
      data: document,
    };
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      error: {
        code: "internal",
        message: "Could not rename document. Try again.",
      },
    };
  }
}

export async function saveDocumentAction(
  documentId: string,
  content: unknown,
  version: number
): Promise<SaveResult> {
  try {
    const result = await udpateContent(documentId, version, content);
    if (result.ok) {
      return {
        ok: true,
        data: result.data,
      };
    } else {
      return {
        ok: false,
        error: result.error,
      };
    }
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      error: {
        code: "internal",
        message: "Somethign went wrong",
      },
    };
  }
}

export async function deleteDocumentAction(documentId: string) {
  const input = deletionSchema.safeParse({ documentId });
  if (!input.success) {
    return {
      ok: false as const,
      error: { code: "validation", message: input.error.issues[0].message },
    };
  }
  try {
    const document = await deleteDocument(input.data.documentId);
    // A repeated delete also succeeds if the record is already gone.
    return {
      ok: true as const,
      data: document ?? { id: input.data.documentId },
    };
  } catch (error) {
    console.error(error);
    return {
      ok: false as const,
      error: {
        code: "internal",
        message: "Could not delete document. Try again.",
      },
    };
  }
}
