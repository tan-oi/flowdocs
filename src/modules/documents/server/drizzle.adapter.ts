import { and, desc, eq } from "drizzle-orm";

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
    .orderBy(desc(documents.updatedAt))
    .limit(limit);
}

export async function getDocument(id: string) {
  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
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
  await db.delete(documents).where(eq(documents.id, id));
}

export async function updateContent(
  id: string,
  content: unknown,
  versionId: number
) {
  const result = await db
    .update(documents)
    .set({ content, revision: versionId + 1 })
    .where(and(eq(documents.id, id), eq(documents.revision, versionId)))
    .returning({ revisedVersion: documents.revision });

  return result[0]?.revisedVersion ?? null;
}

export async function renameDocument(documentId: string, newTitle: string) {
  return await db
    .update(documents)
    .set({ title: newTitle })
    .where(eq(documents.id, documentId))
    .returning();
}
