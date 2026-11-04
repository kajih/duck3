import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// A swipe waits for the exit animation (SWIPE_EXIT_MS, 750 ms) before it is sent, which leaves
// too little room under the default 1 s for findBy/waitFor on a busy machine.
configure({ asyncUtilTimeout: 3000 });

// jsdom has no PointerEvent, so Testing Library would drop clientX and pointerId. Reuse MouseEvent.
if (!window.PointerEvent) {
  class PointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  window.PointerEvent = PointerEvent as typeof window.PointerEvent;
}
