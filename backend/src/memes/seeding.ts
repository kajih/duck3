import { readFileSync } from "node:fs";
import type { MemeRepository } from "./repository.js";
import { seedMemes } from "./seed.js";

/** Existing IDs keep likes intact; insert-once semantics never replace persisted content. */
export function seedMemeRepository(repository: MemeRepository): void {
  for (const seed of seedMemes) {
    repository.add({
      id: seed.id,
      caption: seed.caption,
      seed: true,
      svg: readFileSync(new URL(`../../assets/memes/${seed.file}`, import.meta.url), "utf8"),
    });
  }
}
