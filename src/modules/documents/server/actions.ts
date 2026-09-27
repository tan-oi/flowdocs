"use server";

import { udpateContent } from "./document.service";
import type { SaveResult } from "./document.service";
import { renameDocument } from "./drizzle.adapter";

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
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
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
