import type { Route } from "./+types/api.stream";
import { requireUser } from "~/lib/session.server";
import { requireWorkspace } from "~/lib/workspace.server";
import { subscribe, type BoardEvent } from "~/lib/events.server";

const KEEPALIVE_MS = 25_000;

/** Server-sent events for one workspace. One connection per open tab. */
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { workspace } = await requireWorkspace(user.id, params.workspaceSlug!);

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let keepalive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        if (keepalive) clearInterval(keepalive);
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      };

      write(`retry: 3000\n\n`);
      write(`: connected to ${workspace.slug}\n\n`);

      unsubscribe = subscribe(workspace.id, (event: BoardEvent) => {
        write(`event: board\ndata: ${JSON.stringify(event)}\n\n`);
      });

      keepalive = setInterval(() => write(`: ping\n\n`), KEEPALIVE_MS);
      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      unsubscribe?.();
      if (keepalive) clearInterval(keepalive);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // stops nginx and friends from buffering the stream
      "X-Accel-Buffering": "no",
    },
  });
}
