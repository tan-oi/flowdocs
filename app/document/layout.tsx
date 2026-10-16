import { DocumentWorkspace } from "@/src/modules/editor/components/document-workspace";
import { DocumentManagerProvider } from "@/src/modules/documents/documents-manager/document-manager-provider";
import { listRecent } from "@/src/modules/documents/server";

export default async function DocumentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const recentDocuments = await listRecent(50);

  return (
    <DocumentManagerProvider recentDocuments={recentDocuments}>
      <DocumentWorkspace>{children}</DocumentWorkspace>
    </DocumentManagerProvider>
  );
}
