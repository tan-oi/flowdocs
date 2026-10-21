"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { SLIDE } from "@/components/flow/active-marker";
import { SaveDot, dotOf, type SaveStatus } from "@/components/flow/save-dot";
import type { DocMeta } from "@/src/modules/documents/documents-manager/document.manager";
import { useDocumentNavigation } from "@/src/modules/editor/components/use-document-navigation";
import { RenameInput } from "./rename-input";
import { RowMenu } from "./row-menu";

const MotionMenuItem = motion.create(SidebarMenuItem);

export function DocumentRow({
  doc,
  current,
  status,
  marks,
}: {
  doc: Readonly<DocMeta>;
  current: boolean;
  status?: SaveStatus;
  marks: React.ReactNode;
}) {
  const { showCached } = useDocumentNavigation();
  const { isMobile, setOpenMobile } = useSidebar();
  const [renaming, setRenaming] = useState(false);
  const dot = current ? null : dotOf(status);

  useEffect(() => {
    if (!current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "F2") return;
      event.preventDefault();
      setRenaming(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  return (
    <MotionMenuItem layout="position" transition={SLIDE}>
      {renaming ? (
        <RenameInput doc={doc} onDone={() => setRenaming(false)} />
      ) : (
        <>
          {marks}
          {dot && <SaveDot state={dot} className="top-2.5 left-2.75" />}
          <SidebarMenuButton
            isActive={current}
            render={
              <Link
                href={`/document/${doc.id}`}
                prefetch={false}
                scroll={false}
                aria-current={current ? "page" : undefined}
                onNavigate={(event) => {
                  if (isMobile) setOpenMobile(false);
                  if (showCached(doc.id, "push")) event.preventDefault();
                }}
              />
            }
            className="pl-9 text-[14px] text-muted-foreground hover:text-foreground data-active:bg-transparent data-active:font-normal data-active:text-primary data-active:hover:bg-transparent data-active:hover:text-primary data-active:active:bg-transparent"
          >
            <span>{doc.title}</span>
          </SidebarMenuButton>
          <RowMenu
            doc={doc}
            status={status}
            onRename={() => setRenaming(true)}
          />
        </>
      )}
    </MotionMenuItem>
  );
}
