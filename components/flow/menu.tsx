"use client";

import { createContext, useContext, useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const MenuId = createContext("menu");

export function FlowMenuContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  const id = useId();
  return (
    <DropdownMenuContent
      side="bottom"
      align="end"
      sideOffset={6}
      className={cn(
        "relative w-39 min-w-0 rounded-lg p-1 ring-0",
        "bg-popover shadow-popover",
        "data-open:animate-none data-closed:animate-none",
        "[clip-path:circle(150%_at_var(--transform-origin))] transition-[clip-path,opacity] duration-[260ms,160ms] ease-[cubic-bezier(.4,0,.2,1)]",
        "data-starting-style:[clip-path:circle(0_at_var(--transform-origin))] data-starting-style:opacity-0",
        "data-ending-style:[clip-path:circle(0_at_var(--transform-origin))] data-ending-style:opacity-0 data-ending-style:duration-[180ms,120ms]",
        className
      )}
      {...props}
    >
      <MenuId.Provider value={id}>{children}</MenuId.Provider>
    </DropdownMenuContent>
  );
}

export function FlowMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuItem>) {
  const id = useContext(MenuId);
  return (
    <DropdownMenuItem
      render={(itemProps, state) => (
        <div {...itemProps}>
          {state.highlighted && (
            <motion.span
              layoutId={`${id}-plate`}
              transition={{ type: "spring", duration: 0.28, bounce: 0.15 }}
              aria-hidden="true"
              className="absolute inset-0 -z-10 rounded-md bg-accent"
            />
          )}
          {itemProps.children}
        </div>
      )}
      className={cn(
        "relative z-1 h-7 gap-2 px-2.5 py-0 text-[13px] text-muted-foreground transition-colors duration-100",
        "focus:bg-transparent focus:text-foreground data-highlighted:text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function FlowMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuSeparator>) {
  return (
    <DropdownMenuSeparator
      className={cn("mx-1.5 my-1 bg-border", className)}
      {...props}
    />
  );
}

export function FlowMenuKbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-auto font-sans text-[11px] text-quiet">{children}</kbd>
  );
}
