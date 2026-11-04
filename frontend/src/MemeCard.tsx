import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Direction, Meme } from "./api";
import { MemeRating } from "./MemeRating";

/** Horizontal drag distance (in px) a release must pass to count as a swipe. */
export const SWIPE_THRESHOLD = 100;

interface MemeCardProps {
  meme: Meme;
  onSwipe: (direction: Direction) => void;
  /** Ignores drags, buttons and arrow keys, e.g. while a swipe request is in flight. */
  disabled?: boolean;
}

export function MemeCard({ meme, onSwipe, disabled = false }: MemeCardProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  useEffect(() => {
    if (disabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === "ArrowRight") onSwipe("like");
      if (event.key === "ArrowLeft") onSwipe("nope");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, onSwipe]);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (disabled) return;
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
    if (distance >= SWIPE_THRESHOLD) onSwipe("like");
    else if (distance <= -SWIPE_THRESHOLD) onSwipe("nope");
  }

  function onPointerCancel() {
    setDragging(false);
    setOffset(0);
  }

  return (
    <>
      <figure
        className={`meme-card${dragging ? " dragging" : ""}`}
        style={{ transform: `translateX(${offset}px) rotate(${offset / 20}deg)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <img src={meme.imageUrl} alt={meme.caption} draggable={false} />
        <figcaption>
          <span>{meme.caption}</span>
          <MemeRating stats={meme.stats} />
        </figcaption>
      </figure>
      <div className="actions">
        <button type="button" className="nope" disabled={disabled} onClick={() => onSwipe("nope")}>
          Nope
        </button>
        <button type="button" className="like" disabled={disabled} onClick={() => onSwipe("like")}>
          Like
        </button>
      </div>
    </>
  );
}
