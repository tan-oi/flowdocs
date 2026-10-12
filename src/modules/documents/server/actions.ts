"use server";

import { z } from "zod";
import { udpateContent } from "./document.service";
import type { SaveResult } from "./document.service";
import { create, renameDocument } from "./drizzle.adapter";

const renameSchema = z.object({
  documentId: z.uuid("Invalid document ID"),
  title: z.string().trim().min(1, "Title cannot be empty"),
});

type RenameResult =
  | { ok: true; data: { id: string; title: string; updatedAt: Date } }
  | {
      ok: false;
      error: { code: "validation" | "not_found" | "internal"; message: string };
    };

export async function createDocumentAction() {
  // Simulate a slow creation request while the draft remains editable.
  if (process.env.NODE_ENV === "development") {
    await new Promise<void>((resolve) => setTimeout(resolve, 10000));
  }
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

    if (process.env.NODE_ENV === "development") {
      await new Promise<void>((resolve) => setTimeout(resolve, 10000));
    }
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
