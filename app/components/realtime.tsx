import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useRevalidator } from "react-router";
import { ArrowRight, X } from "lucide-react";
import { Avatar } from "./ui";

export type BoardEvent = {
  id: string;
  kind: string;
  workspaceSlug: string;
  projectSlug: string;
  cardId: string;
  cardTitle: string;
  actor: { id: string; name: string; avatarHue: number; avatarUpdatedAt?: Date | string | null };
  action: string;
  suffix?: string;
  target?: string;
  createdAt: string;
};

const TOAST_MS = 7000;
const MAX_TOASTS = 4;

/**
 * Subscribes to the workspace SSE stream: revalidates on every event so the
 * board stays in sync, and toasts the ones somebody else caused.
 */
export function Realtime({
  workspaceSlug,
  currentUserId,
}: {
  workspaceSlug: string;
  currentUserId: string;
}) {
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<BoardEvent[]>([]);

  // keep the latest revalidate without re-opening the EventSource
  const revalidate = useRef(revalidator.revalidate);
  revalidate.current = revalidator.revalidate;

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const source = new EventSource(`/api/stream/${workspaceSlug}`);
    let pending: ReturnType<typeof setTimeout> | undefined;

    const onEvent = (message: MessageEvent<string>) => {
      let event: BoardEvent;
      try {
        event = JSON.parse(message.data);
      } catch {
        return;
      }

      // coalesce bursts (e.g. a batch of generated cards) into one refresh
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => revalidate.current(), 120);

      if (event.actor.id === currentUserId) return;
      setToasts((prev) => [event, ...prev.filter((t) => t.id !== event.id)].slice(0, MAX_TOASTS));
    };

    source.addEventListener("board", onEvent as EventListener);

    return () => {
      if (pending) clearTimeout(pending);
      source.removeEventListener("board", onEvent as EventListener);
      source.close();
    };
  }, [workspaceSlug, currentUserId]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-16 right-4 z-[60] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((event) => (
        <Toast
          key={event.id}
          event={event}
          onDismiss={() => dismiss(event.id)}
          onOpen={() => {
            dismiss(event.id);
            navigate(
              `/app/${event.workspaceSlug}/p/${event.projectSlug}/card/${event.cardId}`,
            );
          }}
        />
      ))}
    </div>
  );
}

function Toast({
  event,
  onDismiss,
  onOpen,
}: {
  event: BoardEvent;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const deleted = event.kind === "card.deleted";

  return (
    <div
      role="status"
      className="group pointer-events-auto relative animate-slide-in overflow-hidden rounded-box border border-ink-200 bg-base-100 shadow-[0_8px_28px_-10px_hsl(274_40%_8%/0.28)]"
    >
      <button
        type="button"
        onClick={deleted ? onDismiss : onOpen}
        className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-brand-50/50"
      >
        <Avatar user={event.actor} size={26} className="mt-0.5" />

        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-600">
          <span className="font-semibold text-ink-900">{event.actor.name}</span>{" "}
          {event.action}{" "}
          <span className="font-semibold text-ink-900">{event.cardTitle}</span>
          {event.suffix && <> {event.suffix} </>}
          {event.target && <span className="font-semibold text-ink-900">{event.target}</span>}
        </p>

        {!deleted && (
          <ArrowRight className="mt-1 size-3.5 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
        )}
      </button>

      <span
        role="presentation"
        onClick={onDismiss}
        className="absolute top-1.5 right-1.5 grid size-5 cursor-pointer place-items-center rounded text-ink-300 opacity-0 transition-opacity hover:bg-ink-100 hover:text-ink-600 group-hover:opacity-100"
      >
        <X className="size-3" />
      </span>
    </div>
  );
}
