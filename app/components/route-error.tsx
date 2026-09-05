import { Component, type ReactNode } from "react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router";
import { AlertTriangle, ArrowLeft, Ban, SearchX } from "lucide-react";

type Shape = {
  icon: ReactNode;
  title: string;
  detail: string;
  tone: "neutral" | "danger";
};

function describe(error: unknown): Shape {
  if (isRouteErrorResponse(error)) {
    const detail = typeof error.data === "string" ? error.data : error.statusText;
    if (error.status === 404) {
      return {
        icon: <SearchX className="size-5" />,
        title: "Not found",
        detail: detail || "That page or resource does not exist — or you do not have access.",
        tone: "neutral",
      };
    }
    if (error.status === 403) {
      return {
        icon: <Ban className="size-5" />,
        title: "No access",
        detail: detail || "You do not have permission to do that.",
        tone: "neutral",
      };
    }
    return {
      icon: <AlertTriangle className="size-5" />,
      title: `Error ${error.status}`,
      detail: detail || "The server could not complete that request.",
      tone: "danger",
    };
  }

  return {
    icon: <AlertTriangle className="size-5" />,
    title: "Something went wrong",
    detail:
      error instanceof Error && import.meta.env.DEV
        ? error.message
        : "An unexpected error occurred. Try again, or go back and reload.",
    tone: "danger",
  };
}

/**
 * Shared body for every route-level ErrorBoundary. Each route renders it inside
 * whatever chrome it wants to keep — the sidebar, the drawer, the board header.
 */
export function RouteErrorPanel({
  back,
  compact,
}: {
  /** Where "go back" should point. Omitted renders no action. */
  back?: { to: string; label: string };
  compact?: boolean;
}) {
  const error = useRouteError();
  const { icon, title, detail, tone } = describe(error);
  const stack = import.meta.env.DEV && error instanceof Error ? error.stack : undefined;

  return (
    <div
      className={`mx-auto flex w-full max-w-lg flex-col items-center justify-center gap-4 text-center ${
        compact ? "px-6 py-10" : "px-6 py-20"
      }`}
    >
      <div
        className={`grid size-12 place-items-center rounded-2xl ${
          tone === "danger" ? "bg-error/10 text-error" : "bg-brand-50 text-brand-600"
        }`}
      >
        {icon}
      </div>

      <div>
        <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-500">{detail}</p>
      </div>

      {back && (
        <Link to={back.to} className="btn btn-outline btn-sm gap-1.5">
          <ArrowLeft className="size-4" /> {back.label}
        </Link>
      )}

      {stack && (
        <pre className="mt-2 max-h-56 w-full overflow-auto rounded-box bg-ink-100 p-3 text-left text-[11px] leading-relaxed text-ink-600">
          <code>{stack}</code>
        </pre>
      )}
    </div>
  );
}

/**
 * Route boundaries only catch render-time errors inside the route tree. Widgets
 * with their own runtime loops (the game, the editor) get this instead, so a
 * crash in a non-essential extra cannot take the surrounding page down.
 */
export class WidgetBoundary extends Component<
  { children: ReactNode; label: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (import.meta.env.DEV) console.error("[WidgetBoundary]", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mt-4 rounded-box border border-ink-200 bg-ink-100/60 px-4 py-3 text-[13px] text-ink-500">
        {this.props.label} stopped working. The rest of this page is unaffected.
      </div>
    );
  }
}
