"use client";

import { useEffect, useState } from "react";
import { arc, motion } from "motion/react";
import { dotOf, type DotState, type SaveStatus } from "./save-dot";

const COMET_DELAY = 600;
const ROW_HEIGHT = 36;
export const SLIDE = { type: "spring", duration: 0.42, bounce: 0.18 } as const;

type Path = ReturnType<typeof arc>;

function useDelayed(on: boolean, ms: number) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!on) return;
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [on, ms]);
  return on && elapsed;
}

export function useActiveMarker(status: SaveStatus | undefined, index: number) {
  const working = dotOf(status) === "working";
  const showComet = useDelayed(working, COMET_DELAY);
  const dot: DotState = working
    ? showComet
      ? "working"
      : "here"
    : dotOf(status) ?? "here";

  const [seen, setSeen] = useState({ dot, index, bloom: 0, jump: 0 });
  if (seen.dot !== dot || seen.index !== index) {
    setSeen({
      dot,
      index,
      bloom:
        seen.dot === "working" && dot === "here" ? seen.bloom + 1 : seen.bloom,
      jump: seen.index !== index ? index - seen.index : seen.jump,
    });
  }

  const distance = Math.abs(seen.jump) * ROW_HEIGHT;
  const path: Path | undefined = distance
    ? arc({
        strength: Math.min(0.25, 13 / distance),
        direction: seen.jump > 0 ? "ccw" : "cw",
      })
    : undefined;

  return { dot, bloom: seen.bloom, path };
}

export function Marks({
  dot,
  bloom,
  path,
}: {
  dot: DotState;
  bloom: number;
  path?: Path;
}) {
  return (
    <>
      <motion.span
        layoutId="sidebar-plate"
        transition={SLIDE}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-md bg-secondary shadow-raised"
      />
      <motion.span
        layoutId="sidebar-dot"
        transition={{
          type: "spring",
          duration: 0.48,
          bounce: 0.2,
          layout: { type: "spring", duration: 0.48, bounce: 0.2, path },
        }}
        aria-hidden="true"
        className="fd-dot top-2.5 left-2.75 z-1"
        data-state={dot}
      >
        {bloom > 0 && <i key={bloom} className="fd-bloom" />}
      </motion.span>
    </>
  );
}
