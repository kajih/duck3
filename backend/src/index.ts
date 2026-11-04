import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createSqliteMemeRepository } from "./memes/repository.js";
import { createMemeService } from "./memes/service.js";
import { seedMemeRepository } from "./memes/seeding.js";
import { createDeviceLinkService } from "./devices/service.js";
import { createSqliteProfileRepository } from "./profiles/sqlite-repository.js";
import { createProfileService } from "./profiles/service.js";
import { createSqliteSwipeRepository } from "./swipes/sqlite-repository.js";
import { createSwipeService } from "./swipes/service.js";

const port = Number(process.env.PORT ?? 3000);

// Swipes are stored in a SQLite file so they survive restarts. Defaults to backend/data/meme-tinder.db.
const databasePath =
  process.env.DATABASE_PATH ?? fileURLToPath(new URL("../data/meme-tinder.db", import.meta.url));
const repository = createSqliteSwipeRepository(databasePath);

const memeRepository = createSqliteMemeRepository(databasePath);
seedMemeRepository(memeRepository);
const memeService = createMemeService(memeRepository);
const swipeService = createSwipeService(memeService, repository);

// Profiles live in the same database file. They are keyed by the same secret user id, so existing swipes stay theirs.
const profileRepository = createSqliteProfileRepository(databasePath);
const profileService = createProfileService(profileRepository);

// Codes that join a second device to a profile (kept in memory, they only live a few minutes).
const deviceLinkService = createDeviceLinkService({ swipes: swipeService, profiles: profileService });

// Set STATIC_DIR to the built frontend (frontend/dist) to serve it from this process, as the container does.
const staticDir = process.env.STATIC_DIR;

const app = createApp(swipeService, profileService, deviceLinkService, { staticDir, memeService });
const server = app.listen(port, () => {
  console.log(
    `Backend listening on http://localhost:${port} (swipes, memes and profiles stored in ${databasePath})`,
  );
});

// Close the database cleanly on `docker stop`, Ctrl+C and watch-mode restarts.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close();
    repository.close();
    memeRepository.close();
    profileRepository.close();
    process.exit(0);
  });
}
