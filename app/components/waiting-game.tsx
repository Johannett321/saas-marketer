import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Trophy } from "lucide-react";
import type { GameBests } from "~/routes/api.game";

/**
 * Spark Catcher — a keyboard-only game shown only while an AI call is in flight.
 * Sparks fall, you slide the catcher under them. Miss one and the run ends.
 *
 * Everything is in 0-100 field units so the play area can scale freely.
 */

type Phase = "idle" | "playing" | "over";
type Spark = { id: number; x: number; y: number; speed: number };

const CATCHER_W = 16; // field units
const CATCH_Y = 86; // where the catcher's rim sits
const MOVE_SPEED = 78; // units per second
const BASE_FALL = 26;
const FALL_PER_POINT = 1.35;
const MAX_FALL = 88;

export function WaitingGame({
  workspaceSlug,
  /** What the AI is doing right now — kept visible so the wait stays legible. */
  status,
}: {
  workspaceSlug: string;
  status: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [catcherX, setCatcherX] = useState(50);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [bests, setBests] = useState<GameBests | null>(null);

  // The loop owns these; state is only mirrored out of them for rendering,
  // which keeps every state updater pure.
  const keys = useRef({ left: false, right: false });
  const frame = useRef<number | null>(null);
  const catcherRef = useRef(50);
  const sparksRef = useRef<Spark[]>([]);
  const scoreRef = useRef(0);
  const submitted = useRef(false);
  const nextId = useRef(0);

  // ---------------------------------------------------------------- scores

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/game?workspace=${encodeURIComponent(workspaceSlug)}`, {
      headers: { Accept: "application/json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setBests(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const submitScore = useCallback(
    async (value: number) => {
      if (value <= 0 || submitted.current) return;
      submitted.current = true;
      const body = new FormData();
      body.set("workspace", workspaceSlug);
      body.set("score", String(value));
      try {
        const res = await fetch("/api/game", { method: "post", body });
        if (res.ok) setBests(await res.json());
      } catch {
        // a lost score is not worth surfacing
      }
    },
    [workspaceSlug],
  );

  // the AI finishing unmounts this panel — don't lose a run in progress
  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      if (scoreRef.current > 0 && !submitted.current) {
        const body = new FormData();
        body.set("workspace", workspaceSlug);
        body.set("score", String(scoreRef.current));
        navigator.sendBeacon?.("/api/game", body);
      }
    },
    [workspaceSlug],
  );

  useEffect(() => {
    if (phase === "over") void submitScore(scoreRef.current);
  }, [phase, submitScore]);

  // ---------------------------------------------------------------- controls

  const start = useCallback(() => {
    submitted.current = false;
    nextId.current = 0;
    scoreRef.current = 0;
    catcherRef.current = 50;
    sparksRef.current = [
      { id: nextId.current++, x: 20 + Math.random() * 60, y: -6, speed: BASE_FALL },
    ];
    setScore(0);
    setCatcherX(50);
    setSparks(sparksRef.current);
    setPhase("playing");
  }, []);

  useEffect(() => {
    const isTyping = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable);

    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;

      if (e.key === "ArrowLeft" || e.key === "a") {
        keys.current.left = true;
        e.preventDefault();
      } else if (e.key === "ArrowRight" || e.key === "d") {
        keys.current.right = true;
        e.preventDefault();
      } else if (e.key === " " || e.key === "Enter") {
        if (phase !== "playing") {
          start();
          e.preventDefault();
        }
      }
    };

    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") keys.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d") keys.current.right = false;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase, start]);

  // ---------------------------------------------------------------- loop

  useEffect(() => {
    if (phase !== "playing") return;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // --- catcher
      const dir = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
      const half = CATCHER_W / 2;
      catcherRef.current = Math.max(
        half,
        Math.min(100 - half, catcherRef.current + dir * MOVE_SPEED * dt),
      );

      // --- sparks
      const next: Spark[] = [];
      let caught = 0;
      let missed = false;

      for (const spark of sparksRef.current) {
        const y = spark.y + spark.speed * dt;

        if (y >= CATCH_Y && spark.y < CATCH_Y + 8) {
          if (Math.abs(spark.x - catcherRef.current) <= half + 3) {
            caught += 1;
            continue;
          }
        }
        if (y > 104) {
          missed = true;
          continue;
        }
        next.push({ ...spark, y });
      }

      if (missed) {
        sparksRef.current = [];
        setSparks([]);
        setPhase("over");
        return;
      }

      if (caught) {
        scoreRef.current += caught;
        setScore(scoreRef.current);
      }

      // keep one or two sparks in the air, faster as the score climbs
      const target = scoreRef.current >= 8 ? 2 : 1;
      while (next.length < target) {
        const speed = Math.min(
          MAX_FALL,
          BASE_FALL + scoreRef.current * FALL_PER_POINT + Math.random() * 6,
        );
        next.push({
          id: nextId.current++,
          x: 10 + Math.random() * 80,
          y: -6 - Math.random() * 30,
          speed,
        });
      }

      sparksRef.current = next;
      setSparks(next);
      setCatcherX(catcherRef.current);

      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [phase]);

  const personalBest = Math.max(bests?.personalBest ?? 0, phase === "over" ? score : 0);

  return (
    <div className="mt-4 overflow-hidden rounded-box border border-ink-200 bg-base-100">
      <header className="flex flex-wrap items-center gap-2 border-b border-ink-200 bg-ink-100/60 px-4 py-2.5">
        <Loader2 className="size-3.5 shrink-0 animate-spin text-brand-600" />
        <p className="min-w-0 flex-1 text-[12.5px] text-ink-600">
          <span className="font-medium text-ink-800">{status}</span>{" "}
          <span className="text-ink-400">— play while you wait</span>
        </p>
        {phase === "playing" && (
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[12px] font-semibold text-brand-700 tabular-nums">
            {score}
          </span>
        )}
      </header>

      <div className="flex justify-center p-4">
        <div className="relative aspect-square h-[min(22rem,44vh)] overflow-hidden rounded-box border border-ink-200 bg-[radial-gradient(circle_at_50%_0%,hsl(284_90%_62%/0.10),transparent_65%)]">
          {phase === "playing" ? (
            <>
              {sparks.map((spark) => (
                <span
                  key={spark.id}
                  className="absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full brand-gradient text-white shadow-[0_3px_12px_-3px_hsl(284_87%_56%/0.8)]"
                  style={{ left: `${spark.x}%`, top: `${spark.y}%` }}
                >
                  <Sparkles className="size-3.5" />
                </span>
              ))}

              <span
                className="absolute h-2.5 -translate-x-1/2 rounded-full bg-ink-800"
                style={{
                  left: `${catcherX}%`,
                  top: `${CATCH_Y}%`,
                  width: `${CATCHER_W}%`,
                }}
              />
              <span
                className="absolute bottom-0 left-0 h-px w-full bg-ink-200"
                aria-hidden
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              {phase === "over" ? (
                <>
                  <p className="text-[13px] text-ink-500">You dropped one</p>
                  <p className="mt-0.5 text-4xl font-semibold tabular-nums text-ink-900">
                    {score}
                  </p>
                  <p className="mt-3 text-[12.5px] text-ink-500">
                    Press <Kbd>Space</Kbd> to play again
                  </p>
                </>
              ) : (
                <>
                  <div className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                    <Sparkles className="size-5" />
                  </div>
                  <p className="mt-3 text-[14px] font-medium text-ink-800">Spark Catcher</p>
                  <p className="mt-1 max-w-[16rem] text-[12.5px] leading-relaxed text-ink-500">
                    Catch the falling sparks. Drop one and the run is over.
                  </p>
                  <p className="mt-4 text-[12.5px] text-ink-600">
                    <Kbd>←</Kbd> <Kbd>→</Kbd> to move
                  </p>
                  <p className="mt-1.5 text-[12.5px] text-ink-600">
                    <Kbd>Space</Kbd> to start
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-ink-200 px-4 py-2 text-[12px]">
        <span className="text-ink-500">
          Your best <span className="font-semibold text-ink-800 tabular-nums">{personalBest}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-ink-500">
          <Trophy className="size-3 shrink-0 text-warning" />
          <span className="truncate">
            Workspace best{" "}
            <span className="font-semibold text-ink-800 tabular-nums">
              {bests?.workspaceBest ?? 0}
            </span>
            {bests?.workspaceBestBy && (
              <span className="text-ink-400"> · {bests.workspaceBestBy}</span>
            )}
          </span>
        </span>
      </footer>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-ink-300 bg-ink-100 px-1.5 py-0.5 font-sans text-[11px] font-medium text-ink-700">
      {children}
    </kbd>
  );
}
