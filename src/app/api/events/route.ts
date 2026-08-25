import {
  createSnapshotEvent,
  subscribe,
} from "@/lib/exchange/store";
import type { ExchangeEvent } from "@/lib/exchange/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const enqueue = (content: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(content));
        } catch {
          stop(false);
        }
      };

      const send = (event: ExchangeEvent) => {
        enqueue(
          `id: ${event.id}\nretry: 3000\ndata: ${JSON.stringify(event)}\n\n`,
        );
      };

      const unsubscribe = subscribe(send);
      const heartbeat = setInterval(() => {
        enqueue(`: heartbeat ${new Date().toISOString()}\n\n`);
      }, 15_000);

      function stop(closeController: boolean) {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();

        if (closeController) {
          try {
            controller.close();
          } catch {
            // The client may have already closed the stream.
          }
        }
      }

      cleanup = () => stop(false);
      request.signal.addEventListener("abort", () => stop(true), { once: true });

      send(createSnapshotEvent());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
