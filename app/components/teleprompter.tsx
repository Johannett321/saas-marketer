import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Minus, Pause, Play, Plus, X } from "lucide-react";

const SIZES = [22, 26, 32, 38, 46, 56];
const SPEEDS = [0.5, 1, 1.5, 2];

/**
 * Full-screen reading mode for filming: big type, comfortable measure and an
 * auto-scroll you can pace. Nothing here edits the script.
 */
export function Teleprompter({ title, script, onClose }: { title: string; script: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [sizeIndex, setSizeIndex] = useState(2);
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  // auto-scroll in sub-pixel steps so slow speeds still move
  useEffect(() => {
    if (!scrolling) return;
    let raf = 0;
    let last = performance.now();
    let offset = scroller.current?.scrollTop ?? 0;

    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const el = scroller.current;
      if (el) {
        offset += 34 * speed * dt;
        el.scrollTop = offset;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
          setScrolling(false);
          return;
        }
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [scrolling, speed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setScrolling((v) => !v);
      }
      if (e.key === "+" || e.key === "=") setSizeIndex((i) => Math.min(SIZES.length - 1, i + 1));
      if (e.key === "-") setSizeIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="modal m-0 h-dvh max-h-none w-dvw max-w-none bg-base-100 p-0"
    >
      <div className="flex h-dvh w-full flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ink-200 px-6 py-3">
          <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink-800">{title}</p>

          <div className="flex items-center gap-1 rounded-lg border border-ink-200 p-0.5">
            <button
              onClick={() => setSizeIndex((i) => Math.max(0, i - 1))}
              disabled={sizeIndex === 0}
              className="grid size-7 place-items-center rounded text-ink-500 hover:bg-ink-100 disabled:opacity-30"
              aria-label="Smaller text"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-10 text-center text-[12px] tabular-nums text-ink-500">
              {SIZES[sizeIndex]}px
            </span>
            <button
              onClick={() => setSizeIndex((i) => Math.min(SIZES.length - 1, i + 1))}
              disabled={sizeIndex === SIZES.length - 1}
              className="grid size-7 place-items-center rounded text-ink-500 hover:bg-ink-100 disabled:opacity-30"
              aria-label="Larger text"
            >
              <Plus className="size-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-ink-200 p-0.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded px-2 py-1 text-[12px] transition-colors ${
                  speed === s ? "bg-brand-50 font-medium text-brand-700" : "text-ink-500 hover:bg-ink-100"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>

          <button onClick={() => setScrolling((v) => !v)} className="btn btn-primary btn-sm gap-1.5">
            {scrolling ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {scrolling ? "Pause" : "Scroll"}
          </button>

          <button
            onClick={() => ref.current?.close()}
            className="grid size-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close reading mode"
          >
            <X className="size-4" />
          </button>
        </header>

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-6">
          <article
            className="prose-script prose-teleprompter mx-auto max-w-3xl py-14"
            style={{ fontSize: SIZES[sizeIndex], lineHeight: 1.55 }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{script}</ReactMarkdown>
          </article>
          {/* room to keep the last line off the bottom edge */}
          <div className="h-[40vh]" aria-hidden />
        </div>

        <footer className="shrink-0 border-t border-ink-200 px-6 py-2 text-center text-[12px] text-ink-400">
          Space to start and stop scrolling · + and − to resize · Esc to close
        </footer>
      </div>
    </dialog>
  );
}
