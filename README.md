# Meme-Tinder

[![CI](https://github.com/kajih/duck3/actions/workflows/ci.yml/badge.svg)](https://github.com/kajih/duck3/actions/workflows/ci.yml)

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

## Guardrails

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `npm ci`, `npm test` and `npm run build` on every pull request and on every push to `main`, with the Node version from `.nvmrc`. A failing test or a type error turns the check red. **Merge only with a green check.**

To make GitHub enforce this, add a branch protection rule (or ruleset) for `main`: Settings → Branches → Add branch protection rule, branch name pattern `main`, tick "Require status checks to pass before merging" and pick the `Test and build` check (it shows up after the workflow has run once). In a fork, also enable Actions under the Actions tab and change the badge URL at the top of this README to your repository.

## API

All endpoints are under `/api` and need an `X-User-Id` header (the frontend creates an anonymous id on first visit and stores it in localStorage).

| Endpoint                | Description                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `GET /api/memes/next`   | `200 { "meme": {...} }` with the next unseen meme, or `200 { "meme": null }` when all memes have been swiped |
| `POST /api/swipes`      | Body `{ "memeId": "...", "direction": "like" \| "nope" }`. `200` with the stored swipe                       |
| `GET /api/likes`        | `200 { "memes": [...] }` with the user's liked memes in catalog order (`[]` when nothing is liked)           |
| `DELETE /api/swipes`    | Removes all of the user's swipes, including likes. `204 No Content`; safe to call repeatedly                 |
| `GET /api/trending`     | `200 { "window": "last-24-hours" \| "all-time", "memes": [...] }` with the top 10 memes across all users, most liked first; each meme also has `windowLikes` |

Every meme in a response has `stats`: `{ "likes": 4, "swipes": 5, "likePercent": 80 }`, counted across all users. `likePercent` is rounded, and `null` until a meme has 5 swipes; the app then shows "New meme" instead of "80% of people loved this". A user's swipes stop counting when that user resets.

Trending ranks memes by likes in the last 24 hours, then by the share of likes in that time, then in catalog order, and lists only memes with at least one like there. When the last 24 hours have fewer than 10 swipes in total, it falls back to all time, and `window` is `"all-time"`. `windowLikes` is the number of likes in the window; `stats` is all time, as everywhere else. The Trending tab shows which window it uses.

Errors are JSON `{ "error": "..." }`: `400` for a missing user id, missing meme id or invalid direction, `404` for an unknown meme id. Swiping the same meme twice is idempotent: the first swipe is kept.

Swipes are stored in a SQLite file using Node's built-in `node:sqlite`, so they survive restarts. The file is `backend/data/meme-tinder.db` by default; set `DATABASE_PATH` to put it somewhere else. Delete the file to start from scratch. The storage sits behind the `SwipeRepository` interface (`backend/src/swipes/repository.ts`), so another database can be plugged in without changing the service.
