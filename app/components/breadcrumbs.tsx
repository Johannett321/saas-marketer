import { Link, useMatches } from "react-router";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; to?: string };

type BreadcrumbHandle = {
  breadcrumb?: (data: unknown) => Crumb | Crumb[] | null;
};

/**
 * Builds the trail from every matched route that exports
 * `handle = { breadcrumb: (loaderData) => Crumb | Crumb[] }`.
 * The workspace itself is represented by the switcher, so routes only
 * contribute the segments below it.
 */
export function useCrumbs(): Crumb[] {
  const matches = useMatches();
  return matches.flatMap((match) => {
    const handle = match.handle as BreadcrumbHandle | undefined;
    if (!handle?.breadcrumb) return [];
    const result = handle.breadcrumb(match.loaderData);
    if (!result) return [];
    return Array.isArray(result) ? result : [result];
  });
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
      {crumbs.map((crumb, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="size-3.5 shrink-0 text-ink-300" />
            {crumb.to && !last ? (
              <Link
                to={crumb.to}
                className="max-w-[12rem] truncate rounded px-1.5 py-0.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current={last ? "page" : undefined}
                className={`max-w-[16rem] truncate px-1.5 py-0.5 ${
                  last ? "font-medium text-ink-800" : "text-ink-500"
                }`}
              >
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
