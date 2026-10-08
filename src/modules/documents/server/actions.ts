"use server";

import { udpateContent } from "./document.service";
import type { SaveResult } from "./document.service";
import { create, renameDocument } from "./drizzle.adapter";

export async function createDocumentAction() {
  // Simulate a slow creation request while the draft remains editable.
  if (process.env.NODE_ENV === "development") {
    await new Promise<void>((resolve) => setTimeout(resolve, 10000));
  }
  return create("Untitled");
}

export async function rename(title: string, documentId: string) {
  //check auth
  try {
    const result = renameDocument(documentId, title);

    return {
      success: true,
      response: result,
    };
  } catch (err) {
    return {
      success: false,
      response: err + "smth wrong",
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
