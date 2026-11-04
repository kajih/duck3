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

| Command                | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Starts backend and frontend in watch mode     |
| `npm test`             | Runs all backend and frontend tests           |
| `npm run build`        | Builds both workspaces                        |
| `npm run lint`         | Checks TypeScript conventions and React hooks |
| `npm run format`       | Applies shared formatting                     |
| `npm run format:check` | Checks shared formatting                      |

## Guardrails

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `npm ci`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build` on every pull request and on every push to `main`, with the Node version from `.nvmrc`. A lint error, unformatted code, a failing test or a type error turns the check red. **Merge only with a green check.**

To make GitHub enforce this, add a branch protection rule (or ruleset) for `main`: Settings → Branches → Add branch protection rule, branch name pattern `main`, tick "Require status checks to pass before merging" and pick the `Test and build` check (it shows up after the workflow has run once). In a fork, also enable Actions under the Actions tab and change the badge URL at the top of this README to your repository.

Run `npm run lint` and `npm run format:check` before opening a PR; use `npm run format` to apply formatting. Files that come from upstream (`vision/`, `.claude/`) are not formatted or checked, so syncing from upstream cannot break the check.

## API

### Posting SVG memes

The Post tab accepts an SVG image up to 5 MiB, with at most 2000 elements nested at most 32 levels deep, and a nonempty caption of at most 500 characters.
Unsafe SVGs are rejected without modification: scripts, event handlers, external references,
CSS/style attributes, embedded HTML, animation and embedded images are unsupported. Passive SVG
shapes, text and presentation attributes are supported. Uploaded images are served as images with
a restrictive Content Security Policy and `nosniff`.

`POST /api/memes?caption=...` takes a raw `image/svg+xml` body and `X-User-Id`, returning
`201 { "meme": { "id": "...", "caption": "...", "imageUrl": "...", "stats": { ... } } }`.
Missing captions, invalid SVGs and files over the limit return `400 { "error": "..." }`.
`GET /api/memes/:id` returns the meme with current statistics (`404` when unknown); its
`imageUrl` is served by `GET /api/memes/:id/image.svg`.

Uploaded and seed images are stored in the same SQLite file as swipes (`DATABASE_PATH`).
They survive backend and Docker restarts through the existing data volume. Seed IDs remain
stable and are inserted once, preserving existing likes. Duplicate matching is tracked in #9.

### Swipe API

All endpoints are under `/api` and need an `X-User-Id` header (the frontend creates an anonymous id on first visit and stores it in localStorage).

| Endpoint                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/memes?caption=...`      | Raw SVG image body; `201 { meme }`, `400` for invalid input or size                                                                                                                                                                                                                                                                                                                                                                                           |
| `GET /api/memes/:id`               | A meme with current ratings, or `404`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `GET /api/memes/:id/image.svg`     | Passive SVG image with restrictive CSP and nosniff headers                                                                                                                                                                                                                                                                                                                                                                                                    |
| `GET /api/memes/next`              | `200 { "meme": {...} }` with the next unseen meme, or `200 { "meme": null }` when all memes have been swiped                                                                                                                                                                                                                                                                                                                                                  |
| `POST /api/swipes`                 | Body `{ "memeId": "...", "direction": "like" \| "nope" }`. `200` with the stored swipe                                                                                                                                                                                                                                                                                                                                                                        |
| `GET /api/likes`                   | `200 { "memes": [...] }` with the user's liked memes in catalog order (`[]` when nothing is liked)                                                                                                                                                                                                                                                                                                                                                            |
| `DELETE /api/swipes`               | Removes all of the user's swipes, including likes. `204 No Content`; safe to call repeatedly                                                                                                                                                                                                                                                                                                                                                                  |
| `GET /api/trending`                | `200 { "window": "last-24-hours" \| "all-time", "memes": [...] }` with the top 10 memes across all users, most liked first; each meme also has `windowLikes`                                                                                                                                                                                                                                                                                                  |
| `GET /api/stats/swipes-per-minute` | `200 { "swipesPerMinute": 12 }`: swipes (likes and nopes) by all users in the last 60 seconds, counted from the stored swipe times; swipes of a user who resets stop counting                                                                                                                                                                                                                                                                                 |
| `GET /api/profile`                 | `200 { "profile": { "id", "nickname", "emoji" }, "emojiChoices": [...], "nicknameMaxLength": 24 }`. A user without a profile gets one with a generated nickname and emoji                                                                                                                                                                                                                                                                                     |
| `PUT /api/profile`                 | Body `{ "nickname": "...", "emoji": "🦄" }`. `200 { "profile": {...} }`; `400` with a user-facing `error` for an empty or too long nickname or an emoji not in `emojiChoices`                                                                                                                                                                                                                                                                                 |
| `POST /api/device-links`           | `201 { "code": "K7QM-4TXD", "expiresInSeconds": 300 }`: a one-time code for adding another device to this user. A new code replaces the user's earlier unused one                                                                                                                                                                                                                                                                                             |
| `POST /api/device-links/redeem`    | Body `{ "code": "K7QM-4TXD" }` (any case, dash optional), sent with the new device's own `X-User-Id`. `200 { "userId": "..." }`: the id the device must use from now on, after its anonymous swipes were merged into that user (their swipe wins for a meme both swiped) and its own profile was dropped. `400` with a friendly `error` for an unknown, used or expired code, `429` with `Retry-After` after 10 wrong codes from one IP address in 15 minutes |

Every meme in a response has `stats`: `{ "likes": 4, "swipes": 5, "likePercent": 80 }`, counted across all users. `likePercent` is rounded, and `null` until a meme has 5 swipes; the app then shows "New meme" instead of "80% of people loved this". A user's swipes stop counting when that user resets.

Every user has a profile with a nickname and an emoji, created on first use, so people who swiped before profiles existed keep all their swipes and likes. The profile `id` is a public id meant to be shown to other people later; the `X-User-Id` value is a secret that only the user's own device knows, and no endpoint returns it.

**Same you on every device.** The Devices button in the header has "Add a device", which shows a link (`/?link=CODE`) and a short code that work once and expire after 5 minutes. Opening the link, or typing the code under "Use a code from another device", makes that browser the same user: same profile, swipes and likes. A device that joins gets the secret user id of the profile and keeps it in localStorage, so the id is never shown in the UI or URL, only the short-lived code is. The codes are 8 characters from 31 look-alike-free letters and digits, held in memory (a restart only means asking for a new one, so this assumes one backend process), and wrong guesses are rate limited per IP address (behind a reverse proxy, set Express `trust proxy` so that is the client address).

The swipes-per-minute counter (the pulse of the whole app) sits under the card and is shown in every view. The frontend polls the endpoint every 5 seconds (`SWIPE_RATE_POLL_MS`), stops while the browser tab is hidden and refreshes right away when it is visible again. Polling was chosen over a live stream because it needs no long-lived connections on the server and the number only has to be about right; when the shared live stream of #30 exists, the counter can switch to it without changing the endpoint.

Trending ranks memes by likes in the last 24 hours, then by the share of likes in that time, then in catalog order, and lists only memes with at least one like there. When the last 24 hours have fewer than 10 swipes in total, it falls back to all time, and `window` is `"all-time"`. `windowLikes` is the number of likes in the window; `stats` is all time, as everywhere else. The Trending tab shows which window it uses.

Errors are JSON `{ "error": "..." }`: `400` for a missing user id, missing meme id or invalid direction, `404` for an unknown meme id. Swiping the same meme twice is idempotent: the first swipe is kept.

Swipes are stored in a SQLite file using Node's built-in `node:sqlite`, so they survive restarts. The file is `backend/data/meme-tinder.db` by default; set `DATABASE_PATH` to put it somewhere else. Delete the file to start from scratch. The storage sits behind the `SwipeRepository` interface (`backend/src/swipes/repository.ts`), so another database can be plugged in without changing the service.
