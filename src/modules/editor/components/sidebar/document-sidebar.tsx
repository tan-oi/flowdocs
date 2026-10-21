"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Marks, useActiveMarker } from "@/components/flow/active-marker";
import type { SaveStatus } from "@/components/flow/save-dot";
import type { DocMeta } from "@/src/modules/documents/documents-manager/document.manager";
import { useDocumentManagerSnapshot } from "@/src/modules/documents/documents-manager/document-manager-provider";
import { groupDocuments } from "./document-groups";
import { DocumentRow } from "./document-row";

const PAGE = 20;

const footerText: Record<SaveStatus, string> = {
  saved: "Saved",
  unsaved: "Editing",
  saving: "Saving",
  creating: "Saving",
  retrying: "Retrying",
  error: "Not saved",
  conflict: "Changed elsewhere. Not saved",
  paused: "",
};

export default function DocumentSidebar() {
  const { recentDocuments, activeRepository, repositories } =
    useDocumentManagerSnapshot();
  const [visible, setVisible] = useState(PAGE);
  const [now] = useState(() => Date.now());
  const [folded, setFolded] = useState<Record<string, boolean>>({});

  const activeId = activeRepository?.documentId ?? null;
  const activeStatus = activeRepository?.getSnapshot();
  const draft = activeRepository && !activeRepository.documentId;
  const { recent, older } = groupDocuments(recentDocuments, visible, now);

  const order = [
    ...(draft ? ["draft"] : []),
    ...recent.map((d) => d.id),
    ...older.map((d) => d.id),
  ];
  const marker = useActiveMarker(
    activeStatus,
    order.indexOf(draft ? "draft" : activeId ?? "")
  );
  const marks = <Marks {...marker} />;

  const isCurrent = (doc: Readonly<DocMeta>) => doc.id === activeId;
  const row = (doc: Readonly<DocMeta>) => (
    <DocumentRow
      key={doc.id}
      doc={doc}
      current={isCurrent(doc)}
      status={repositories
        .find((repo) => repo.documentId === doc.id)
        ?.getSnapshot()}
      marks={isCurrent(doc) ? marks : null}
    />
  );

  return (
    <Sidebar
      aria-label="Documents"
      variant="floating"
      className="p-2.5 *:data-[slot=sidebar-inner]:rounded-[16px]! *:data-[slot=sidebar-inner]:bg-linear-to-b *:data-[slot=sidebar-inner]:from-card *:data-[slot=sidebar-inner]:to-sidebar *:data-[slot=sidebar-inner]:shadow-sheet! *:data-[slot=sidebar-inner]:ring-0!"
    >
      <SidebarHeader className="gap-0 p-0">
        <div className="flex items-center gap-2.5 px-4.5 pt-5 pb-4.5">
          <div className="grid size-7.5 place-items-center rounded-[9px] bg-orange-soft text-[13px] font-medium text-primary shadow-raised">
            F
          </div>
          <div className="min-w-0">
            <strong className="block text-[14px] leading-4.5 font-medium tracking-[-0.015em] text-foreground">
              Flowdocs
            </strong>
            <span className="text-[12px] leading-4 text-muted-foreground">
              Personal workspace
            </span>
          </div>
        </div>
        <div className="border-b border-border/70 px-2.5 pb-3.5">
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href="/document/new" scroll={false} />}
            className="w-full justify-start gap-2.5 rounded-md text-[14px] font-normal shadow-raised"
          >
            <Plus className="size-3.5 text-primary" />
            New document
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <div className="relative isolate px-2.5 py-4.5">
          {draft && (
            <SidebarGroup className="mb-5 p-0">
              <SidebarGroupLabel className="mb-1.5 h-auto px-3 text-[13px] leading-4 text-muted-foreground">
                Writing
              </SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem className="flex h-8 items-center pr-3 pl-9 text-[14px] text-primary">
                  {marks}
                  <span className="truncate">{activeRepository.title}</span>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          )}
          {[
            { label: "Recents", docs: recent },
            { label: "Older", docs: older },
          ].map(({ label, docs }) =>
            docs.length === 0 ? null : (
              <SidebarGroup key={label} className="mb-5 p-0 last:mb-0">
                <SidebarGroupLabel
                  render={
                    <button
                      type="button"
                      aria-expanded={!folded[label]}
                      onClick={() => setFolded((f) => ({ ...f, [label]: !f[label] }))}
                    />
                  }
                  className="mb-1.5 h-auto gap-1 px-3 text-[13px] leading-4 text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:text-foreground focus-visible:ring-0 [&>svg]:size-3"
                >
                  {label}
                  <ChevronDown className={folded[label] ? "-rotate-90 transition-transform" : "transition-transform"} />
                </SidebarGroupLabel>
                <SidebarMenu className="gap-1">
                  {(folded[label] ? docs.filter(isCurrent) : docs).map(row)}
                </SidebarMenu>
              </SidebarGroup>
            )
          )}

          {recentDocuments.length > visible && (
            <Button
              variant="ghost"
              onClick={() => setVisible((n) => n + PAGE)}
              className="w-full justify-start pl-9 text-[13px] font-normal text-quiet"
            >
              Show more
            </Button>
          )}
          {recentDocuments.length === 0 && !draft && (
            <p className="px-3 text-[13px] leading-5 text-quiet">
              Create a document to start writing.
            </p>
          )}
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/70 px-5 py-3.5 text-[11px] text-quiet">
        <span role="status">
          {activeStatus ? footerText[activeStatus] : ""}
        </span>
      </SidebarFooter>
    </Sidebar>
  );
}
