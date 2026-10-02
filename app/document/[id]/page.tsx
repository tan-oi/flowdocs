import { notFound } from "next/navigation";
import { DocumentRouteSync } from "@/src/modules/editor/components/document-workspace";
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

  return <DocumentRouteSync document={document} />;
}
