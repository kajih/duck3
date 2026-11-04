import { useEffect, useState } from "react";

/** How often the counter asks for a fresh number. Polling keeps it simple; a live stream can replace it later. */
export const SWIPE_RATE_POLL_MS = 5000;

interface SwipesPerMinuteProps {
  /** Resolves to the number of swipes by all users in the last minute. */
  load: () => Promise<number>;
  intervalMs?: number;
}

/**
 * A small live counter of swipes per minute across the whole app. It polls while the tab is visible,
 * stops while it is hidden, and refreshes as soon as the tab is visible again. It stays out of the way:
 * nothing shows until the first number arrives, a failed refresh keeps the last number, and the
 * text is not a live region, so screen readers are not interrupted every few seconds.
 */
export function SwipesPerMinute({ load, intervalMs = SWIPE_RATE_POLL_MS }: SwipesPerMinuteProps) {
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function refresh() {
      try {
        const next = await load();
        if (!cancelled) setRate(next);
      } catch {
        // The counter is a nice extra: keep showing the last number and try again next time.
      }
    }

    function start() {
      if (timer !== undefined) return;
      void refresh();
      timer = setInterval(refresh, intervalMs);
    }

    function stop() {
      clearInterval(timer);
      timer = undefined;
    }

    function onVisibilityChange() {
      if (document.hidden) stop();
      else start();
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load, intervalMs]);

  if (rate === null) return null;
  return (
    <p className="swipe-rate">
      <span aria-hidden="true">🔥</span> {rate} {rate === 1 ? "swipe" : "swipes"} per minute
    </p>
  );
}
