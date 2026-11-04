# Changelog

<!-- All notable changes below this line -->

## Unreleased

### Added

- SVG uploads with a caption, a 5 MiB limit (and at most 2000 elements nested at most 32 levels deep, so validation cannot block the server), server-side validation, a Post form, durable storage beside existing swipes, rated detail responses and restrictive image headers (#8).
- Same you on every device: a Devices button in the header with "Add a device" (a one-time link and short code that expire after 5 minutes) and "Use a code from another device". Opening the link (`/?link=CODE`, redeemed before the first memes load, with the code removed from the address) or typing the code makes the new device the same user: same profile, swipes and likes, and its anonymous swipes are merged in without duplicates (the profile's swipe wins for a meme both swiped, swipe times are kept). Used, expired or wrong codes get a friendly message; codes are 8 characters from a look-alike-free alphabet and wrong guesses are rate limited per IP address (10 per 15 minutes, `429` with `Retry-After`). `POST /api/device-links` and `POST /api/device-links/redeem`; `SwipeRepository.moveByUser` and `ProfileRepository.remove` (with shared contract tests) and `createDeviceLinkService`. Arrow keys typed in a text field no longer swipe the card (kajih/duck3#25)
- Shared ESLint checks for TypeScript conventions and React hooks, Prettier formatting commands, and required CI style checks; `AGENTS.md` directs Codex to the shared instructions in `CLAUDE.md`; files that come from upstream (`vision/`, `.claude/`) are not formatted or checked, and CI runs the quick style checks before tests and build (#4).
- Profiles: every user has a nickname and an emoji, shown in the header and changed from a small profile panel (nickname up to 24 characters, emoji from a fixed list, with validation messages); created with a generated nickname like "Giggling Otter" on first use, so existing users keep all their swipes and likes. `GET /api/profile` and `PUT /api/profile`; profiles are stored in SQLite next to the swipes, behind a `ProfileRepository` with shared contract tests; each profile has a public id separate from the secret user id (kajih/duck3#24)
- Celebrations: plenty of confetti (150 pieces, CSS only, no dependency) after 5 likes in a row (`STREAK_LENGTH`; a nope resets the streak, and it starts over after each celebration), and a bigger moment on the 100th swipe (`MILESTONE_SWIPES`), shown once and instead of a streak on the same swipe. Counted from the swipes in this session (page load or reset), not from history. The overlay ignores pointer events, never takes focus and goes away after 3 s; with `prefers-reduced-motion` the confetti is hidden and only the message shows (kajih/duck3#7)
- Meme fingerprints for duplicate detection (`backend/src/memes/fingerprint.ts`), the groundwork for blocking duplicate posts: an image and caption count as the same meme when the SVG matches after ignoring formatting whitespace between elements, whitespace inside tags, attribute order and quote style (text spacing and visual properties still count) and the caption matches after trimming, collapsing whitespace and ignoring capitalization; meant to be stored with a unique index so concurrent duplicate posts cannot both be saved. Not wired to an endpoint yet, that waits for uploads in #8 (part of kajih/duck3#9)
- CI with GitHub Actions: `npm ci`, `npm test` and `npm run build` on every pull request and push to `main`, with Node from `.nvmrc` and the npm cache; a CI badge and a Guardrails section in the README on requiring a green check and setting it up in branch protection (kajih/duck3#3)
- Trending tab next to Likes with the top 10 memes people are loving right now: ranked by likes in the last 24 hours (falling back to all time when there were fewer than 10 swipes that day, and saying so on the page), with likes in the window, the like percentage, and gold, silver and bronze ranks; `GET /api/trending` and `SwipeRepository.countAllByMemeSince`, with a `swiped_at` index in SQLite and swipe times in the in-memory repository too (kajih/duck3#12)
- The card that follows a swipe springs in from behind (grows from 85% with a small overshoot and fades in, 350 ms, `CARD_ENTER_MS`), and swipes are ignored until it has arrived; the first card and the card after a reset just appear. With `prefers-reduced-motion` the next card appears without animation and can be swiped right away. CSS only (kajih/duck3#6)
- Arrow keys are listened for from the moment a card is shown (layout effect), so a key pressed right after a card appears is not lost, and frontend tests wait up to 3 s for async UI because swipes now take 750 ms (kajih/duck3#6)
- Tests for the entrance (swipes blocked until it is done), reduced motion, and the swiped card leaving toward its direction from where it was released (kajih/duck3#6)

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

- Closed SQLite repositories before removing temporary test directories so the contract suite also runs on Windows (#4).

- After a drag swipe the card leaves from where it was released instead of first jumping back to the middle; with `prefers-reduced-motion` it fades out there, starting at the swipe and ending as the next card appears. `MemeCard` passes the drag position to CSS as `--drag-x` and `--drag-rotate` instead of an inline `transform` (kajih/duck3#6)

- The meme card no longer clips its content (`overflow: hidden`), so the stamp tool can come down from outside it; the image has its own rounded top corners (kajih/duck3#5)
- `MemeCard` calls `onSwipe` once the card has left (`SWIPE_EXIT_MS`, 750 ms: 450 ms stamping, 300 ms flying out) so the stamp can be seen, and ignores further swipes in the meantime; `onSwipe` may return a promise, and if the card is still shown when it settles (a failed swipe) the card comes back (kajih/duck3#5)

- The backend requires Node 22.13 or newer (for `node:sqlite`); `deploy/README.md` now gives the correct `STATIC_DIR=../frontend/dist` for running the production setup locally (kajih/duck3#2)

- `CLAUDE.md`: standard header, `PORT` env var, adding memes needs SVG and seed entry, running tests by name, frontend test config location, that the build is the type check, and how to run the production setup locally

- `MemeCard` now takes `onSwipe(direction)` and owns the Like and Nope buttons, which moved out of `App`; buttons are disabled while a swipe request is in flight (#7)
- The plain "No more memes." text is replaced by the `EmptyState` component (#5)
- `GET /api/memes/next` is now per user (requires `X-User-Id`) and returns `{ "meme": ... }`, with `{ "meme": null }` when all memes are swiped (#3)
- `createApp` now takes a swipe service instead of the meme catalog (#3)
