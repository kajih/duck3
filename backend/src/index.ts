import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createMemeCatalog } from "./memes/catalog.js";
import { createSqliteSwipeRepository } from "./swipes/sqlite-repository.js";
import { createSwipeService } from "./swipes/service.js";

const port = Number(process.env.PORT ?? 3000);

// Swipes are stored in a SQLite file so they survive restarts. Defaults to backend/data/meme-tinder.db.
const databasePath =
  process.env.DATABASE_PATH ?? fileURLToPath(new URL("../data/meme-tinder.db", import.meta.url));
const repository = createSqliteSwipeRepository(databasePath);

const swipeService = createSwipeService(createMemeCatalog(), repository);

// Set STATIC_DIR to the built frontend (frontend/dist) to serve it from this process, as the container does.
const staticDir = process.env.STATIC_DIR;

const server = createApp(swipeService, { staticDir }).listen(port, () => {
  console.log(`Backend listening on http://localhost:${port} (swipes stored in ${databasePath})`);
});

// Close the database cleanly on `docker stop`, Ctrl+C and watch-mode restarts.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close();
    repository.close();
    process.exit(0);
  });
}
