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
    <div className="flow-workspace">
      <OpenedDocument
        id={document.id}
        title={document.title}
        updatedAt={document.updatedAt}
      />
      <main className="flow-document">
        <div className="flow-document__topline">
          <span>My workspace</span>
          <span className="flow-document__separator">/</span>
          <span className="flow-document__current">{document.title}</span>
        </div>
        <div className="flow-document__body">
          <DocumentEditor key={document.id} document={document} />
        </div>
      </main>
    </div>
  );
}
