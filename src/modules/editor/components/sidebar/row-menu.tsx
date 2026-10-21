"use client";

import { useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuAction } from "@/components/ui/sidebar";
import {
  FlowMenuContent,
  FlowMenuItem,
  FlowMenuKbd,
  FlowMenuSeparator,
} from "@/components/flow/menu";
import { SaveDot, type SaveStatus } from "@/components/flow/save-dot";
import { useDocumentManager } from "@/src/modules/documents/documents-manager/document-manager-provider";
import type { DocMeta } from "@/src/modules/documents/documents-manager/document.manager";
import { useDocumentNavigation } from "@/src/modules/editor/components/use-document-navigation";

export function RowMenu({
  doc,
  status,
  onRename,
}: {
  doc: Readonly<DocMeta>;
  status?: SaveStatus;
  onRename: () => void;
}) {
  const manager = useDocumentManager();
  const { leaveDeleted } = useDocumentNavigation();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const renaming = useRef(false);

  const remove = async () => {
    setDeleting(true);
    setDeleteFailed(false);
    const result = await manager.deleteDocument(doc.id);
    setDeleting(false);
    if (!result.ok) return setDeleteFailed(true);
    setOpen(false);
    leaveDeleted(doc.id);
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) renaming.current = false;
        else {
          setConfirming(false);
          setDeleteFailed(false);
        }
      }}
    >
      <DropdownMenuTrigger
        render={<SidebarMenuAction showOnHover />}
        aria-label={`Options for ${doc.title}`}
        className="cursor-pointer text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <FlowMenuContent finalFocus={() => !renaming.current}>
        {(status === "error" || status === "conflict") && (
          <>
            <div className="flex h-6.5 items-center gap-2 px-2.5 text-[12px] text-foreground">
              <SaveDot state="failed" className="static -ml-0.5 scale-[.85]" />
              {status === "conflict" ? "Changed elsewhere" : "Not saved"}
            </div>
            {status === "error" && (
              <FlowMenuItem
                onClick={() =>
                  void manager
                    .getRepositoryByDocumentId(doc.id)
                    ?.saveNow()
                    .catch(() => {})
                }
              >
                Retry now
              </FlowMenuItem>
            )}
            <FlowMenuSeparator />
          </>
        )}
        <FlowMenuItem
          onClick={() => {
            renaming.current = true;
            onRename();
          }}
        >
          Rename
          <FlowMenuKbd>F2</FlowMenuKbd>
        </FlowMenuItem>
        <FlowMenuItem
          closeOnClick={false}
          disabled={deleting}
          onClick={() => (confirming ? void remove() : setConfirming(true))}
          className={confirming ? "text-foreground" : undefined}
        >
          {confirming && (
            <span
              aria-hidden="true"
              className="-ml-px size-1.25 rounded-full bg-foreground"
            />
          )}
          {deleting
            ? "Deleting"
            : deleteFailed
            ? "Could not delete. Try again"
            : confirming
            ? "Delete for good"
            : "Delete"}
        </FlowMenuItem>
      </FlowMenuContent>
    </DropdownMenu>
  );
}
