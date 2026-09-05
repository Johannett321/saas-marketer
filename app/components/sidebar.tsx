import { Link, NavLink } from "react-router";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { LevelView } from "./level-transition";

/**
 * The frame is mounted once, in the app layout, and stays put for the whole
 * session. Stepping between the workspace and a project swaps only the
 * `SidebarSection` inside it, so the panel never repaints — the border and
 * background hold still while the items move.
 */
export function Sidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-200 bg-base-200/50 lg:flex">
      {children}
    </aside>
  );
}

/**
 * One level's worth of sidebar. Give it a `key` that changes with the level so
 * it remounts — that is what triggers the directional animation.
 */
export function SidebarSection({
  badge,
  title,
  subtitle,
  eyebrow,
  back,
  children,
}: {
  /** Distinct per level, so the badge alone says where you are. */
  badge: ReactNode;
  title: string;
  subtitle?: string | null;
  eyebrow: string;
  back?: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    // trails the content column slightly so the two read as one movement
    <LevelView className="flex min-h-0 flex-col px-3 py-3" offset={10} delay={0.04}>
      {back && (
        <Link
          to={back.to}
          className="group mb-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700"
        >
          <ArrowLeft className="size-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5" />
          <span className="truncate">{back.label}</span>
        </Link>
      )}

      <div className="flex items-center gap-2.5 px-2 py-2">
        {badge}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] leading-tight font-semibold text-ink-900">
            {title}
          </span>
          {subtitle && (
            <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-ink-400">
              {subtitle}
            </span>
          )}
        </span>
      </div>

      <div className="my-2 h-px bg-ink-200/70" />

      <p className="px-2 pb-1 text-[10.5px] font-medium tracking-wider text-ink-400 uppercase">
        {eyebrow}
      </p>
      <nav className="space-y-0.5">{children}</nav>
    </LevelView>
  );
}

/** The workspace badge: a filled brand tile carrying the initial. */
export function WorkspaceBadge({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-xl text-[13px] font-bold text-white shadow-sm brand-gradient"
    >
      {name[0]?.toUpperCase()}
    </span>
  );
}

/** The project badge: deliberately lighter than the workspace's, one level in. */
export function ProjectBadge({ icon }: { icon: ReactNode }) {
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 ring-inset"
    >
      {icon}
    </span>
  );
}

export function SidebarLink({
  to,
  end,
  icon,
  children,
  count,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  children: ReactNode;
  count?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex items-center justify-between gap-2.5 rounded-lg py-2 pr-2.5 pl-3 text-sm transition-colors ${
          isActive
            ? "bg-brand-50 font-medium text-brand-700"
            : "text-ink-600 hover:bg-ink-100 hover:text-ink-800"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            className={`absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500 transition-opacity ${
              isActive ? "opacity-100" : "opacity-0"
            }`}
          />
          <span className="flex min-w-0 items-center gap-2.5">
            <span className={`shrink-0 ${isActive ? "text-brand-500" : "opacity-70"}`}>{icon}</span>
            <span className="truncate">{children}</span>
          </span>
          {count !== undefined && (
            <span
              className={`shrink-0 rounded-full px-1.5 text-[11px] tabular-nums ${
                isActive ? "bg-brand-100 text-brand-700" : "bg-ink-200 text-ink-600"
              }`}
            >
              {count}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
