# Like Duel repository audit — Imposter integration

Branch: `feature/imposter-game-hub`  
Audit date: 2026-11-15  
Scope: frontend navigation/auth/socket client, Express + Socket.IO backend, bot entry point, tests and mobile build workflows.

## 1. Current architecture

- Frontend: React 19 + Create React App, one root `App.js` screen switcher, Socket.IO client, Telegram Mini App SDK and Capacitor wrappers.
- Backend: one large ES-module Express/Socket.IO process in `like-duel-backend/server.js`, MongoDB through Mongoose.
- Identity: Telegram WebApp initData or signed app JWT is verified on the server. Socket identity is stored in `socket.data.tgId`.
- Existing product features: Like Duel online, Like Duel vs bot, profile, leaderboard, referrals, wallet and shop.
- Mobile: Android/iOS Capacitor projects build the same React app; GitHub Actions currently build Android and unsigned iOS artifacts on pushes to `main`.

## 2. Findings and risks

### F-01 — There is no shared game hub yet
**Evidence:** `frontend/src/App.js` uses `currentScreen` string state. The menu directly lists Like Duel, bot, leaderboard, wallet, shop and referrals. There is no game catalogue or Imposter route/component.

**Impact:** Imposter should be introduced as a new screen/feature and the current Like Duel menu entry should remain available. Avoid replacing the existing app shell.

### F-02 — Frontend navigation is centralized in a large component
**Evidence:** `App.js` owns auth lifecycle, socket listeners, notifications, account actions and all screen selection/render branches.

**Impact:** A minimal hub can be added safely, but new Imposter screens and state should live under a dedicated feature folder. Do not grow the root component into the game engine.

### F-03 — Backend game logic is monolithic
**Evidence:** `like-duel-backend/server.js` contains environment checks, auth, Mongoose schemas, HTTP routes, rate limiting, economy, and Socket.IO game handlers.

**Impact:** First implementation should isolate Imposter logic in separate backend modules and mount/register it from the existing server. A second server or replacement backend is unnecessary and would complicate deployment/auth.

### F-04 — Existing Like Duel runtime rooms are memory-backed
**Evidence:** `searchQueue`, `activeRooms` and `onlineUsers` are process-local collections. Duel room summaries/escrow are also written to MongoDB; `recoverStaleRooms()` refunds active rooms after restart rather than restoring an in-progress match.

**Impact:** Imposter needs an explicit persistence policy. Room membership, phase, round state, votes and deadlines must be stored or safely reconstructed; a restart must not leak secret roles or strand players.

### F-05 — Socket event handlers must derive identity from verified socket context
**Evidence:** Socket middleware verifies initData/JWT and sets `socket.data.tgId`. Existing `find_match` uses that verified ID and does not trust the player ID sent by the client. Room membership is checked by socket ID in `make_choice`.

**Impact:** All Imposter events must follow the same rule: never accept a client-supplied user ID as authority. Check authenticated membership, room phase and allowed action on every event.

### F-06 — Secret data needs a stricter event boundary
**Evidence:** Existing Like Duel broadcasts some room-level game state; Imposter has asymmetric secret information (word/role).

**Impact:** Public room snapshots must contain only safe fields. The assigned word/role must be delivered through a private socket response to that player only; never include it in room broadcasts, logs, admin payloads or generic room serialization.

### F-07 — Bot entry point has a dependency mismatch
**Evidence:** `like-duel-backend/bot.js` imports `telegraf`, but `like-duel-backend/package.json` does not declare `telegraf`.

**Impact:** The standalone bot entry point will not install its direct runtime dependency from this package manifest. Before extending bot/group entry for Imposter, decide whether to add a properly configured Telegraf dependency/process or route bot commands through the existing deployed bot service. Do not assume this file is currently deployable.

### F-08 — Existing frontend test is stale
**Evidence:** `frontend/src/App.test.js` is still the Create React App starter test and expects “learn react”, while the real app renders Login or Like Duel UI.

**Impact:** The current test does not validate the product and is expected to fail against the real app. Replace it with tests for auth/loading and navigation; add isolated Imposter tests. Test commands have not been executed in this remote repository audit.

### F-09 — Root app and mobile share the same frontend
**Evidence:** Capacitor sync runs `npm run build` against `frontend`; Android/iOS workflows use the same React bundle.

**Impact:** A single Game Hub and Imposter UI implementation will be available to Telegram Mini App and Capacitor builds. Avoid platform-specific forks; use Telegram/Capacitor capability adapters where needed.

### F-10 — Existing economy is coupled to Like Duel
**Evidence:** Existing user model and transaction ledger include Like Duel coins, duel escrow, purchases and bot rewards.

**Impact:** Imposter should not spend or award Like Duel coins by default. Keep its statistics/rating independent until a separate economy decision is made.

## 3. Integration plan

1. Add a Game Hub entry point while preserving all current Like Duel screens and actions.
2. Create `frontend/src/features/imposter/` for screens, components, state and API/socket adapters.
3. Register Imposter backend handlers from a dedicated module; namespace every event with `imposter:`.
4. Add isolated MongoDB models/collections for Imposter rooms, players, rounds, votes and statistics.
5. Enforce server-side phase transitions, membership, player limits, vote uniqueness, timeouts and rate limits.
6. Deliver role/word only through private player events. Public room state must be allow-listed.
7. Add online room creation/join/invite flow first; then clue/discussion/voting/results.
8. Add AI players and Telegram bot/group deep links after core online flow is stable.
9. Add local pass-and-play mode with a private reveal/hide handoff flow.
10. Replace the stale starter test and add backend/frontend tests; run production build and tests before PR/merge.

## 4. Scope boundaries

- Preserve Like Duel online/bot gameplay, profile, wallet, shop, referrals, leaderboard and Capacitor support.
- Reuse current verified auth and MongoDB connection.
- Do not introduce a second backend or rewrite the existing game.
- Do not share Like Duel coins with Imposter without an explicit product decision.
- No production deployment, merge to `main`, or live bot configuration was performed as part of this audit.

## 5. Verification status

This audit is based on source files fetched from `feature/imposter-game-hub`. No local install/build/test execution was available in this GitHub-only inspection step. Findings marked as expected failures should be confirmed by the next CI/test run.
