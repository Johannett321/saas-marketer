import { createContext, useContext, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";

/**
 * Moving between siblings (Projects → Analytics, Kanban → Settings) changes
 * nothing structural, so it must not animate. Changing *level* — stepping into a
 * project, or back up to the workspace — does, and the motion is directional so
 * the step reads as forward or back rather than as a generic fade.
 *
 * Direction has to be known by the layout mounting on the same commit, so it is
 * derived during render here rather than in an effect a frame later.
 */

type Direction = -1 | 0 | 1;

const DirectionContext = createContext<Direction>(0);

/** /app → 0, workspace pages → 1, project pages → 2. */
function depthOf(pathname: string) {
  if (/^\/app\/[^/]+\/p\/[^/]+/.test(pathname)) return 2;
  // `new` and `profile` sit beside the workspaces rather than inside one
  if (/^\/app\/(?!new(?:\/|$)|profile(?:\/|$))[^/]+/.test(pathname)) return 1;
  return 0;
}

export function LevelTransitionProvider({ children }: { children: ReactNode }) {
  const depth = depthOf(useLocation().pathname);
  const [seen, setSeen] = useState<number | null>(null);
  const [direction, setDirection] = useState<Direction>(0);

  if (seen !== depth) {
    setDirection(seen === null ? 0 : (Math.sign(depth - seen) as Direction));
    setSeen(depth);
  }

  return (
    // `domAnimation` is the small feature set — transforms and opacity, which is
    // all this app animates. `strict` makes the full `motion.*` bundle a type
    // error rather than a silent regression back to the heavy import.
    <LazyMotion features={domAnimation} strict>
      <DirectionContext.Provider value={direction}>{children}</DirectionContext.Provider>
    </LazyMotion>
  );
}

/**
 * Animates in when the level it belongs to mounts. A sibling navigation keeps the
 * same instance mounted, so nothing moves; only a level change remounts it.
 */
export function LevelView({
  children,
  className,
  /** How far it travels, in px. The sidebar moves less than the content beside it. */
  offset = 22,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  offset?: number;
  delay?: number;
}) {
  const direction = useContext(DirectionContext);
  const reduced = useReducedMotion();

  // First paint and reduced motion both start settled: `false` skips the animation.
  const still = direction === 0 || reduced;

  return (
    <m.div
      className={className}
      initial={still ? false : { opacity: 0, x: direction * offset }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.34, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </m.div>
  );
}
