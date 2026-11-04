import { useEffect, type CSSProperties } from "react";
import type { Celebration } from "./celebration";

/** How long (in ms) a celebration stays on screen. Keep in sync with styles.css. */
export const CELEBRATION_MS = 3000;

const PIECES = 150;
const COLORS = ["#2e9e5b", "#d64545", "#f5b700", "#3b82f6", "#a855f7"];

function message(celebration: Celebration): string {
  return celebration.kind === "milestone"
    ? `🎉 ${celebration.swipes} swipes! You are a true meme connoisseur.`
    : `🔥 ${celebration.likes} likes in a row!`;
}

/**
 * Confetti drawn with CSS only, plus a message. It never takes focus or catches pointer events,
 * so swiping carries on underneath. With reduced motion the confetti is hidden and only the
 * message shows (styles.css).
 */
export function CelebrationBurst({ celebration, onDone }: { celebration: Celebration; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [celebration, onDone]);

  return (
    <div className={`celebration celebration-${celebration.kind}`}>
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: PIECES }, (_, i) => (
          <span
            key={i}
            style={
              {
                "--x": `${((i * 37) % 100) - 50}vw`,
                "--delay": `${(i % 12) * 50}ms`,
                "--spin": `${(i % 2 ? 1 : -1) * (360 + i * 20)}deg`,
                background: COLORS[i % COLORS.length],
                left: `${(i * 53) % 100}%`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <p role="status" className="celebration-message">
        {message(celebration)}
      </p>
    </div>
  );
}
