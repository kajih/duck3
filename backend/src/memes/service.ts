import { randomUUID } from "node:crypto";
import type { Meme, MemeCatalog } from "./catalog.js";
import type { MemeRepository, StoredMeme } from "./repository.js";
import { ContentError, validateSvg } from "./svg.js";

export interface MemeService extends MemeCatalog {
  image(id: string): string | undefined;
  post(caption: unknown, svg: unknown): Meme;
}

export function toMeme(meme: StoredMeme): Meme {
  return {
    id: meme.id,
    caption: meme.caption,
    imageUrl: `/api/memes/${encodeURIComponent(meme.id)}/image.svg`,
  };
}

export function createMemeService(repository: MemeRepository): MemeService {
  return {
    list: () => repository.list().map(toMeme),
    getById(id) {
      const meme = repository.get(id);
      return meme ? toMeme(meme) : undefined;
    },
    image: (id) => repository.get(id)?.svg,
    post(caption, svg) {
      if (typeof caption !== "string" || !caption.trim() || caption.length > 500) {
        throw new ContentError("Caption is required and must be 500 characters or fewer");
      }
      if (typeof svg !== "string") throw new ContentError("Choose an SVG image");
      validateSvg(svg);
      const meme: StoredMeme = { id: randomUUID(), caption: caption.trim(), svg, seed: false };
      if (!repository.add(meme)) throw new Error("Unable to save meme");
      return toMeme(meme);
    },
  };
}
