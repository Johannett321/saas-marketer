import { clsx } from "clsx";
import type { ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return clsx(parts);
}

export type AvatarUser = {
  id: string;
  name: string;
  avatarHue: number;
  /** Set when the user has uploaded a picture; doubles as the cache key. */
  avatarUpdatedAt?: Date | string | null;
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

/**
 * The uploaded picture when there is one, otherwise initials tinted by the
 * user's stored hue.
 */
export function Avatar({
  user,
  size = 28,
  className,
  title,
}: {
  user: AvatarUser;
  size?: number;
  className?: string;
  title?: string;
}) {
  const label = title ?? user.name;

  if (user.avatarUpdatedAt) {
    return (
      <img
        src={`/avatar/${user.id}?v=${new Date(user.avatarUpdatedAt).getTime()}`}
        alt={label}
        title={label}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.38),
        background: `linear-gradient(135deg, hsl(${user.avatarHue} 80% 62%), hsl(${(user.avatarHue + 38) % 360} 75% 45%))`,
        boxShadow: `0 0 0 1px hsl(${user.avatarHue} 60% 70% / 0.25)`,
      }}
    >
      {initials(user.name)}
    </span>
  );
}

export function Logo({ className, size = 30 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className="relative grid place-items-center rounded-xl brand-gradient shadow-[0_6px_20px_-8px_#bc2ef0]"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.6, height: size * 0.6 }}>
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h6A2.5 2.5 0 0 1 15 7.5v9A2.5 2.5 0 0 1 12.5 19h-6A2.5 2.5 0 0 1 4 16.5v-9Z" fill="white" fillOpacity=".95" />
          <path d="m17 10.2 2.6-1.7c.6-.4 1.4 0 1.4.8v5.4c0 .8-.8 1.2-1.4.8L17 13.8v-3.6Z" fill="white" fillOpacity=".7" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-ink-900">saas-marketer</span>
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-box border border-dashed border-ink-200 bg-ink-100/60 px-6 py-12 text-center">
      {icon && (
        <div className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">{icon}</div>
      )}
      <div>
        <p className="font-medium text-ink-800">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[13px] text-error">{children}</p>;
}
