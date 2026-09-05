import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  Link,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export const meta: Route.MetaFunction = () => [
  { title: "saas-marketer" },
  { name: "description", content: "Kanban and AI scripts for marketing videos." },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="saasmarketer">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="app-aurora font-sans text-ink-800 antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something went wrong";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Not found" : `Error ${error.status}`;
    details =
      error.status === 404
        ? "That page or resource does not exist — or you do not have access."
        : typeof error.data === "string"
          ? error.data
          : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="relative z-10 mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-3xl">⚠️</div>
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">{message}</h1>
        <p className="mt-2 text-ink-600">{details}</p>
      </div>
      <Link to="/app" className="btn btn-primary">
        Back to the app
      </Link>
      {stack && (
        <pre className="mt-4 max-h-72 w-full overflow-auto rounded-box bg-ink-100 p-4 text-left text-xs text-ink-600">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
