import { and, desc, eq, isNull } from "drizzle-orm";

import { documents } from "@/src/db/schema";
import { db } from "@/src/db";

export async function listRecent(limit: number) {
  return db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(isNull(documents.deletedAt))
    .orderBy(desc(documents.updatedAt))
    .limit(limit);
}

export async function getDocument(id: string) {
  const [document] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
    .limit(1);

  return document ?? null;
}

export async function create(title: string) {
  const [document] = await db
    .insert(documents)
    .values({
      title,
      content: { type: "doc", content: [] },
    })
    .returning();

  return document;
}

export async function deleteDocument(id: string) {
  const [document] = await db
    .update(documents)
    .set({ deletedAt: new Date() })
    .where(eq(documents.id, id))
    .returning({ id: documents.id });

  return document ?? null;
}

export async function updateContent(
  id: string,
  content: unknown,
  versionId: number
) {
  const result = await db
    .update(documents)
    .set({ content, revision: versionId + 1 })
    .where(
      and(
        eq(documents.id, id),
        eq(documents.revision, versionId),
        isNull(documents.deletedAt)
      )
    )
    .returning({ revisedVersion: documents.revision });

  return result[0]?.revisedVersion ?? null;
}

export async function renameDocument(documentId: string, newTitle: string) {
  const [document] = await db
    .update(documents)
    .set({ title: newTitle, updatedAt: new Date() })
    .where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
    .returning({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
    });

  return document ?? null;
}
