# Running Meme-Tinder

The app runs either in Docker (one command, no Node needed) or locally with Node.

## Docker

Requires Docker with Compose. From the repository root:

```bash
docker compose -f deploy/docker-compose.yml up --build
```

Open http://localhost:3000. Stop with `Ctrl+C`, or `docker compose -f deploy/docker-compose.yml down` if you started it with `-d`.

How it works:

- One container, one process, one port (3000). There is no CORS or proxy configuration.
- `deploy/Dockerfile` is multi-stage (`node:22-alpine`, matching `.nvmrc`). The build stage installs all workspaces and runs `npm run build`. The final stage installs only the backend's production dependencies and copies in the built backend, the meme assets and the built frontend.
- The backend serves the built frontend when the `STATIC_DIR` environment variable is set (the image sets it to `/app/frontend/dist`). Unknown non-API paths fall back to `index.html`; `/api` paths are never shadowed.
- Swipes are stored in a SQLite file on the `meme-data` volume (`DATABASE_PATH=/data/meme-tinder.db`), so they survive restarts and `docker compose down` / `up`. To start from scratch, remove the volume: `docker compose -f deploy/docker-compose.yml down -v`.
- To use another host port, change `"3000:3000"` in `deploy/docker-compose.yml`, for example to `"8080:3000"`.

## Local

Requires Node.js 22.13 or newer (see `.nvmrc`; run `nvm use` if you use nvm) and npm 10 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the backend on port 3000. Swipes are stored in `backend/data/meme-tinder.db` (override with `DATABASE_PATH`).

To try the production setup without Docker:

```bash
npm run build
STATIC_DIR=../frontend/dist npm start -w backend
```

Then open http://localhost:3000.
