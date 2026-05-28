import { useEffect, useRef } from "react";

type EventHandler = (type: string, data: unknown) => void;

/**
 * Open a Server-Sent Events connection to the given URL and call
 * onEvent for each named event received. Closes automatically when
 * the component unmounts or when the url changes.
 *
 * The events list controls which named events to listen for.
 * "error" is always listened to — pass it in events or the handler won't fire on error.
 */
export function useSSEJob(
  url: string | null,
  events: string[],
  onEvent: EventHandler
) {
  // Keep a stable ref to the latest callback so we don't need to close/reopen
  // the EventSource when the parent re-renders and recreates the callback.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!url) return;

    const es = new EventSource(url, { withCredentials: true });

    const handlers: Array<[string, EventListener]> = events.map((name) => {
      const handler: EventListener = (e) => {
        try {
          const parsed = JSON.parse((e as MessageEvent).data);
          onEventRef.current(name, parsed);
        } catch {
          onEventRef.current(name, (e as MessageEvent).data);
        }
      };
      es.addEventListener(name, handler);
      return [name, handler];
    });

    return () => {
      handlers.forEach(([name, handler]) => es.removeEventListener(name, handler));
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
}
