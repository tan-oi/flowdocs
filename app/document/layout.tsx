import { DocumentWorkspace } from "@/src/modules/editor/components/document-workspace";
import { DocumentManagerProvider } from "@/src/modules/documents/documents-manager/document-manager-provider";
import { listRecent } from "@/src/modules/documents/server";
import { cookies } from "next/headers";

export default async function DocumentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const recentDocuments = await listRecent(50);
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value === "true";

  return (
    <DocumentManagerProvider recentDocuments={recentDocuments}>
      <DocumentWorkspace sidebarOpen={sidebarOpen}>
        {children}
      </DocumentWorkspace>
    </DocumentManagerProvider>
  );
}
