import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Direction, Meme } from "./api";

/** Horizontal drag distance (in px) a release must pass to count as a swipe. */
export const SWIPE_THRESHOLD = 100;

/**
 * How long (in ms) the leaving animation takes before `onSwipe` is called: the stamp tool comes
 * down and lifts (450 ms), then the card flies out (300 ms). Keep in sync with styles.css.
 */
export const SWIPE_EXIT_MS = 750;

interface MemeCardProps {
  meme: Meme;
  /**
   * Called once the card has left. If the card is still shown when the returned promise settles
   * (for example because recording the swipe failed), it comes back to the middle.
   */
  onSwipe: (direction: Direction) => void | Promise<void>;
  /** Ignores drags, buttons and arrow keys, e.g. while a swipe request is in flight. */
  disabled?: boolean;
}

export function MemeCard({ meme, onSwipe, disabled = false }: MemeCardProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<Direction | null>(null);
  const startX = useRef(0);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inactive = disabled || leaving !== null;

  useEffect(() => () => clearTimeout(exitTimer.current), []);

  function swipe(direction: Direction) {
    if (inactive) return;
    setLeaving(direction);
    exitTimer.current = setTimeout(() => {
      // On success the parent shows the next meme with a new card, so this only matters on failure.
      Promise.resolve(onSwipe(direction)).finally(() => setLeaving(null));
    }, SWIPE_EXIT_MS);
  }

  useEffect(() => {
    if (inactive) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === "ArrowRight") swipe("like");
      if (event.key === "ArrowLeft") swipe("nope");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (inactive) return;
    startX.current = event.clientX;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (dragging) setOffset(event.clientX - startX.current);
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (!dragging) return;
    const distance = event.clientX - startX.current;
    setDragging(false);
    setOffset(0);
    if (distance >= SWIPE_THRESHOLD) swipe("like");
    else if (distance <= -SWIPE_THRESHOLD) swipe("nope");
  }

  function onPointerCancel() {
    setDragging(false);
    setOffset(0);
  }

  // Stamp strength grows with drag distance and is full once the card is leaving.
  const strength = Math.min(Math.abs(offset) / SWIPE_THRESHOLD, 1);
  const likeOpacity = leaving ? (leaving === "like" ? 1 : 0) : offset > 0 ? strength : 0;
  const nopeOpacity = leaving ? (leaving === "nope" ? 1 : 0) : offset < 0 ? strength : 0;

  const classes = ["meme-card"];
  if (dragging) classes.push("dragging");
  if (leaving) classes.push(`leaving-${leaving}`);

  return (
    <>
      <figure
        className={classes.join(" ")}
        style={leaving ? undefined : { transform: `translateX(${offset}px) rotate(${offset / 20}deg)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <img src={meme.imageUrl} alt={meme.caption} draggable={false} />
        <span className="stamp stamp-like" aria-hidden="true" style={{ opacity: likeOpacity }}>
          LIKE
        </span>
        <span className="stamp stamp-nope" aria-hidden="true" style={{ opacity: nopeOpacity }}>
          NOPE
        </span>
        {leaving && (
          <span className={`stamp-tool stamp-tool-${leaving}`} aria-hidden="true" data-testid="stamp-tool" />
        )}
        <figcaption>{meme.caption}</figcaption>
      </figure>
      <div className="actions">
        <button type="button" className="nope" disabled={inactive} onClick={() => swipe("nope")}>
          Nope
        </button>
        <button type="button" className="like" disabled={inactive} onClick={() => swipe("like")}>
          Like
        </button>
      </div>
    </>
  );
}
