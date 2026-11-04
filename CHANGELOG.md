# Changelog

<!-- All notable changes below this line -->

## Unreleased

### Added

- Trending tab next to Likes with the top 10 memes people are loving right now: ranked by likes in the last 24 hours (falling back to all time when there were fewer than 10 swipes that day, and saying so on the page), with likes in the window, the like percentage, and gold, silver and bronze ranks; `GET /api/trending` and `SwipeRepository.countAllByMemeSince`, with a `swiped_at` index in SQLite and swipe times in the in-memory repository too (kajih/duck3#12)
- Every meme card and liked meme shows how much people love it, for example "87% of people loved this", or "New meme" below 5 swipes; memes from `GET /api/memes/next` and `GET /api/likes` include `stats` (`likes`, `swipes`, `likePercent`) counted across all users, and `SwipeRepository` has `countByMeme` (kajih/duck3#11)
- LIKE and NOPE stamps on the swipe card, large and diagonal across the meme image (sized from the card width): while dragging, the matching stamp fades in with the drag distance, and after a drag, button or arrow-key swipe a physical rubber stamp (wooden block and knob, seen from above) comes down, presses the stamp onto the meme and lifts away before the card flies out. Stamps and the stamp tool are `aria-hidden`, and with `prefers-reduced-motion` there is no stamp tool, the stamp appears in place and the card fades instead of flying. CSS only, no animation library (kajih/duck3#5)
- Testing Library tests for which stamp shows for each direction and swipe input, the stamp tool, and the card coming back after a failed swipe (kajih/duck3#5)

- Swipes and likes survive restarts: a SQLite swipe repository using Node's built-in `node:sqlite`, stored at `backend/data/meme-tinder.db` or `DATABASE_PATH`, with a `swiped_at` time per swipe for later stats; Docker keeps it on the `meme-data` volume; the backend closes the database on SIGINT/SIGTERM; shared contract tests for every `SwipeRepository` (kajih/duck3#2)

- 20 more memes (SVG assets and seed entries), bringing the catalog to 30

- Agent guidance in `CLAUDE.md`: architecture, folder structure, commands, coding conventions, extension points (`SwipeRepository`, service vs. HTTP layer) and the rule that `CHANGELOG.md` is updated with every change (#8)

- Docker setup in `deploy/`: multi-stage `Dockerfile` (`node:22-alpine`), `docker-compose.yml` and a `README.md` for Docker and local start; root `.dockerignore` and a link from the root README (#4)
- The backend serves the built frontend when `STATIC_DIR` is set, with an SPA fallback that never answers `/api` paths, plus Supertest tests for it (#4)

- Drag gestures on the swipe card using pointer events (touch and mouse, no gesture library): the card follows the pointer, a release past 100 px likes or nopes, and a shorter release snaps back (#7)
- Left and right arrow keys swipe (nope and like) in the swipe view only, and are ignored while a swipe request is in flight (#7)
- Frontend tests for the `MemeCard` buttons, arrow keys and drag threshold, and for arrow keys and double-swipe protection in the app (#7)

- `GET /api/likes` returns `{ "memes": [...] }` with the user's liked memes in catalog order, and `listLikedMemes` on the swipe service (#6)
- Frontend likes view (`LikesView`) with an empty message, Swipe/Likes navigation and a typed `fetchLikes()` in the API client (#6)
- Service, Supertest and frontend tests for the likes list and likes view (#6)

- Reset of a user's swipes (including likes): `DELETE /api/swipes` (`204`), `resetSwipes` on the swipe service and `clearByUser` on `SwipeRepository` (#5)
- Frontend empty state ("You have seen all memes") with a Reset button, and a typed `resetSwipes()` in the API client (#5)
- Service, Supertest and frontend tests for the reset flow and the empty state (#5)

- Swipe service and in-memory swipe repository (behind a `SwipeRepository` interface) in the backend (#3)
- `POST /api/swipes` endpoint; swiped memes are never returned again, repeated swipes keep the first one (#3)
- Anonymous user id (localStorage) sent as `X-User-Id`, plus Like and Nope buttons in the frontend (#3)
- Frontend error message when the backend is unreachable or returns an error (#3)
- Unit tests for the swipe service, Supertest tests for the swipe endpoints and frontend swipe tests (#3)

- npm workspaces monorepo with `backend` (Express + TypeScript) and `frontend` (React + Vite + TypeScript) (#2)
- Ten original SVG programmer-humour memes with captions and a meme catalog in the backend (#2)
- `GET /api/memes/next` endpoint and static serving of meme images under `/api/memes/images` (#2)
- Frontend that fetches a meme and shows it as a static card, with `/api` proxied to the backend (#2)
- Vitest example tests in both workspaces (Supertest for the backend, Testing Library for the frontend) (#2)
- `.nvmrc` and `engines` requiring Node 22+ and npm 10+; README with requirements and quick start (#2)

### Changed

- The meme card no longer clips its content (`overflow: hidden`), so the stamp tool can come down from outside it; the image has its own rounded top corners (kajih/duck3#5)
- `MemeCard` calls `onSwipe` once the card has left (`SWIPE_EXIT_MS`, 750 ms: 450 ms stamping, 300 ms flying out) so the stamp can be seen, and ignores further swipes in the meantime; `onSwipe` may return a promise, and if the card is still shown when it settles (a failed swipe) the card comes back (kajih/duck3#5)

- The backend requires Node 22.13 or newer (for `node:sqlite`); `deploy/README.md` now gives the correct `STATIC_DIR=../frontend/dist` for running the production setup locally (kajih/duck3#2)

- `CLAUDE.md`: standard header, `PORT` env var, adding memes needs SVG and seed entry, running tests by name, frontend test config location, that the build is the type check, and how to run the production setup locally

- `MemeCard` now takes `onSwipe(direction)` and owns the Like and Nope buttons, which moved out of `App`; buttons are disabled while a swipe request is in flight (#7)
- The plain "No more memes." text is replaced by the `EmptyState` component (#5)
- `GET /api/memes/next` is now per user (requires `X-User-Id`) and returns `{ "meme": ... }`, with `{ "meme": null }` when all memes are swiped (#3)
- `createApp` now takes a swipe service instead of the meme catalog (#3)
