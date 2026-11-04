# Meme-Tinder

Tinder but for memes

A proof of concept that workshop teams fork and extend. It is an npm workspaces monorepo:

- `backend/`: Express + TypeScript API on port 3000. Serves the seed memes (original SVGs in `backend/assets/memes`).
- `frontend/`: React + Vite + TypeScript on port 5173. The dev server proxies `/api` to the backend.

## Requirements

- Node.js 22.13 or newer (see `.nvmrc`; run `nvm use` if you use nvm)
- npm 10 or newer

## Quick start

```bash
npm install
npm run dev
```

To run in Docker instead, or for more detail on both options, see [deploy/README.md](deploy/README.md).

Open http://localhost:5173, then swipe memes by dragging the card, with the Like and Nope buttons or with the left and right arrow keys, and use the Likes tab to see what you liked. When all memes are swiped, press Reset to start over.

## Commands

| Command         | What it does                                  |
| --------------- | --------------------------------------------- |
| `npm run dev`   | Starts backend and frontend in watch mode     |
| `npm test`      | Runs all backend and frontend tests           |
| `npm run build` | Builds both workspaces                        |

## API

All endpoints are under `/api` and need an `X-User-Id` header (the frontend creates an anonymous id on first visit and stores it in localStorage).

| Endpoint                | Description                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `GET /api/memes/next`   | `200 { "meme": {...} }` with the next unseen meme, or `200 { "meme": null }` when all memes have been swiped |
| `POST /api/swipes`      | Body `{ "memeId": "...", "direction": "like" \| "nope" }`. `200` with the stored swipe                       |
| `GET /api/likes`        | `200 { "memes": [...] }` with the user's liked memes in catalog order (`[]` when nothing is liked)           |
| `DELETE /api/swipes`    | Removes all of the user's swipes, including likes. `204 No Content`; safe to call repeatedly                 |

Every meme in a response has `stats`: `{ "likes": 4, "swipes": 5, "likePercent": 80 }`, counted across all users. `likePercent` is rounded, and `null` until a meme has 5 swipes; the app then shows "New meme" instead of "80% of people loved this". A user's swipes stop counting when that user resets.

Errors are JSON `{ "error": "..." }`: `400` for a missing user id, missing meme id or invalid direction, `404` for an unknown meme id. Swiping the same meme twice is idempotent: the first swipe is kept.

Swipes are stored in a SQLite file using Node's built-in `node:sqlite`, so they survive restarts. The file is `backend/data/meme-tinder.db` by default; set `DATABASE_PATH` to put it somewhere else. Delete the file to start from scratch. The storage sits behind the `SwipeRepository` interface (`backend/src/swipes/repository.ts`), so another database can be plugged in without changing the service.
