import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { InvalidLinkCodeError, TooManyAttemptsError, type DeviceLinkService } from "./devices/service.js";
import { IMAGE_PATH } from "./memes/catalog.js";
import {
  InvalidProfileError,
  NICKNAME_MAX_LENGTH,
  PROFILE_EMOJIS,
  type ProfileService,
} from "./profiles/service.js";
import { DIRECTIONS, type Direction } from "./swipes/repository.js";
import { UnknownMemeError, type SwipeService } from "./swipes/service.js";
import type { MemeService } from "./memes/service.js";
import { ContentError } from "./memes/svg.js";

const assetsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/memes");

/** Returns the user id from the X-User-Id header, or sends 400 and returns null. */
function requireUserId(req: Request, res: Response): string | null {
  const userId = req.header("X-User-Id")?.trim();
  if (!userId) {
    res.status(400).json({ error: "Missing X-User-Id header" });
    return null;
  }
  return userId;
}

function isDirection(value: unknown): value is Direction {
  return DIRECTIONS.includes(value as Direction);
}

export interface AppOptions {
  memeService?: MemeService;
  /** Directory with the built frontend. When set, it is served as static files with an SPA fallback. */
  staticDir?: string;
}

export function createApp(
  swipeService: SwipeService,
  profileService: ProfileService,
  deviceLinkService: DeviceLinkService,
  options: AppOptions = {},
) {
  const app = express();
  app.use(express.json());

  app.use(IMAGE_PATH, express.static(assetsDir));

  // 200 with { meme }. When the user has swiped every meme, meme is null.
  app.get("/api/memes/next", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    res.json({ meme: swipeService.getNextMeme(userId) });
  });

  // 200 with the stored swipe. Swiping the same meme twice keeps the first swipe.
  app.post("/api/swipes", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const { memeId, direction } = req.body ?? {};
    if (typeof memeId !== "string" || !memeId) {
      res.status(400).json({ error: "memeId is required" });
      return;
    }
    if (!isDirection(direction)) {
      res.status(400).json({ error: `direction must be one of: ${DIRECTIONS.join(", ")}` });
      return;
    }
    try {
      res.json(swipeService.recordSwipe(userId, memeId, direction));
    } catch (err) {
      if (err instanceof UnknownMemeError) {
        res.status(404).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  // 200 with { memes }: the user's liked memes in catalog order, or an empty list.
  app.get("/api/likes", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    res.json({ memes: swipeService.listLikedMemes(userId) });
  });

  // 200 with { window, memes }: the most liked memes in the trending window, most liked first.
  app.get("/api/trending", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    res.json(swipeService.listTrending());
  });

  // 200 with { swipesPerMinute }: swipes by all users in the last 60 seconds, the app's pulse.
  app.get("/api/stats/swipes-per-minute", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    res.json({ swipesPerMinute: swipeService.getSwipesPerMinute() });
  });

  // 200 with { profile, emojiChoices, nicknameMaxLength }. Creates a profile with a generated nickname and emoji on first use.
  app.get("/api/profile", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    res.json({
      profile: profileService.getProfile(userId),
      emojiChoices: PROFILE_EMOJIS,
      nicknameMaxLength: NICKNAME_MAX_LENGTH,
    });
  });

  // 200 with { profile } after changing nickname and emoji; 400 with a user-facing error for bad input.
  app.put("/api/profile", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const { nickname, emoji } = req.body ?? {};
    try {
      res.json({ profile: profileService.updateProfile(userId, { nickname, emoji }) });
    } catch (err) {
      if (err instanceof InvalidProfileError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  // 201 with { code, expiresInSeconds }: a one-time code (also used as a link) that joins another device to this user.
  app.post("/api/device-links", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const { code, expiresInSeconds } = deviceLinkService.createLink(userId);
    res.status(201).json({ code, expiresInSeconds });
  });

  // 200 with { userId }: the id this device must use from now on. 400 for an unknown, used or expired code, 429 after too many wrong ones.
  app.post("/api/device-links/redeem", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const { code } = req.body ?? {};
    if (typeof code !== "string" || !code.trim()) {
      res.status(400).json({ error: "code is required" });
      return;
    }
    try {
      res.json(deviceLinkService.redeem(userId, code, req.ip ?? "unknown"));
    } catch (err) {
      if (err instanceof InvalidLinkCodeError) {
        res.status(400).json({ error: err.message });
        return;
      }
      if (err instanceof TooManyAttemptsError) {
        res.set("Retry-After", String(err.retryAfterSeconds)).status(429).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  // 204 No Content. Removes all of the user's swipes, including likes. Safe to repeat.
  app.delete("/api/swipes", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    swipeService.resetSwipes(userId);
    res.status(204).end();
  });

  if (options.memeService) {
    const memes = options.memeService;
    app.post(
      "/api/memes",
      express.text({ type: "image/svg+xml", limit: "5mb", inflate: false }),
      (req, res) => {
        if (!requireUserId(req, res)) return;
        if (!req.is("image/svg+xml")) throw new ContentError("Choose an SVG image");
        const meme = memes.post(req.query.caption, req.body);
        res.status(201).json({ meme: swipeService.getMeme(meme.id) });
      },
    );
    app.get("/api/memes/:id/image.svg", (req, res) => {
      const svg = memes.image(req.params.id);
      if (svg === undefined) throw new ContentError("Meme not found", 404);
      res
        .set({
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Security-Policy": "default-src 'none'; style-src 'none'; sandbox",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-store",
        })
        .send(svg);
    });
    // Keep this after the fixed /memes/next route.
    app.get("/api/memes/:id", (req, res) => {
      if (!requireUserId(req, res)) return;
      const meme = swipeService.getMeme(req.params.id);
      if (!meme) throw new ContentError("Meme not found", 404);
      res.json({ meme });
    });
  }

  // Built frontend (production only). Registered after the API routes and never answers /api paths.
  if (options.staticDir) {
    const staticDir = path.resolve(options.staticDir);
    app.use(express.static(staticDir));
    app.use((req, res, next) => {
      const isApiPath = req.path === "/api" || req.path.startsWith("/api/");
      if ((req.method !== "GET" && req.method !== "HEAD") || isApiPath) {
        next();
        return;
      }
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  // Malformed JSON bodies and other client errors from middleware get a JSON error too.
  app.use((err: { status?: number; message?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ContentError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err.status === 413) {
      res.status(400).json({ error: "SVG must be 5 MB or smaller" });
      return;
    }
    const status = err.status && err.status < 500 ? err.status : 500;
    res.status(status).json({ error: status < 500 ? "Invalid request" : "Internal server error" });
  });

  return app;
}
