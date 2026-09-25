import { notFound } from "next/navigation";
import { OpenedDocument } from "@/src/modules/documents/documents-manager/opened-document";
import { DocumentEditor } from "@/src/modules/editor/document-editor";
import { getDocument } from "@/src/modules/documents/server";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!UUID_PATTERN.test(id)) notFound();
  const document = await getDocument(id);

  if (!document) notFound();

  return (
    <main>
      <OpenedDocument
        id={document.id}
        title={document.title}
        updatedAt={document.updatedAt}
      />
      <h1>{document.title}</h1>
      <DocumentEditor key={document.id} document={document} />
    </main>
  );
}
