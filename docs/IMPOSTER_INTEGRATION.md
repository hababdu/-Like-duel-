# Imposter Game Hub Integration

## Goal

Turn this repository into a Telegram-first multi-game hub while preserving Like Duel as a working, first-class game. Add Imposter as a separate game module selected from the hub.

## Existing foundation (keep and extend)

- React 19 frontend in `frontend/`, with Telegram Mini App SDK, Socket.IO client, and Capacitor wrappers.
- Express + Socket.IO backend in `like-duel-backend/`.
- MongoDB user identity and existing Telegram `initData` / app-token verification.
- Existing Like Duel gameplay, leaderboard, profile, referrals, wallet, shop, and bot mode must remain available.

Do not replace the current stack with a second backend or rewrite Like Duel as part of this integration.

## Product navigation

1. Game Hub / Home
   - Like Duel card
   - Imposter card
   - Shared account/profile entry
2. Like Duel
   - Preserve its current online duel, bot game, leaderboard, wallet, shop, and profile flows.
3. Imposter
   - Online room: create, join by invite/deep link, lobby, ready state, start, private role/word delivery, clue/discussion, voting, results.
   - Local pass-and-play: one device is handed between players; private role/word reveal is hidden before the next player receives the device.
   - AI players: optional room fillers, clearly identified as bots; server controls their role, clues, and votes.
   - Telegram group/bot entry: bot can create or share a room link; actual gameplay remains in the Mini App.

## Architecture boundaries

- Reuse the verified account identity, but keep game-domain data separate.
- Add an Imposter feature namespace in the frontend (for example `features/imposter/`) and isolate its screens, components, API client, socket events, and styles.
- Add backend modules/services for Imposter rooms, game state, role assignment, round flow, voting, and bot players. Keep existing Like Duel handlers intact.
- Prefix all new Socket.IO events with `imposter:` to avoid collisions with current Like Duel events.
- Store Imposter rooms, rounds, player membership, votes, and statistics in separate MongoDB collections/models.
- Keep Imposter ratings/statistics separate from Like Duel ratings/statistics.
- Do not silently share, transfer, spend, or award Like Duel coins in Imposter. Economy integration requires an explicit product decision and server-side ledger design.

## Game integrity and privacy

- Validate Telegram `initData` or the existing app session on the server for every authenticated operation.
- Derive the player identity from verified server-side auth; never trust a client-supplied user ID.
- Keep secret roles and words on the server. Send private role/word data only to the relevant player.
- Shared room snapshots must never contain hidden roles, secret words, or private player state.
- Enforce server-side phase transitions, player limits, vote eligibility, and one-vote-per-player rules.
- Use cryptographically secure randomness for role assignment and word selection.
- Make room creation/join/start/vote operations idempotent where practical and rate-limit them.
- Local mode must not expose a player's secret to the next player through persisted/shared state.

## Initial delivery sequence

1. Audit and map current frontend navigation, auth, socket middleware, backend routes/events, Mongo models, and deployment settings.
2. Add the Game Hub while preserving the existing Like Duel menu and routes.
3. Implement Imposter online room lifecycle and private role assignment.
4. Implement clue/discussion/voting/result phases and reconnect handling.
5. Add Telegram bot deep-link/group entry.
6. Add optional AI players.
7. Add local pass-and-play mode.
8. Add automated tests for authorization, hidden information, room transitions, reconnects, and voting.
9. Verify frontend production build and backend tests before proposing a merge to `main`.

## Non-goals for the first integration

- No rewrite of Like Duel.
- No removal of the existing Android/iOS Capacitor targets.
- No automatic migration of Like Duel wallet balances or rankings into Imposter.
- No production secrets or real bot tokens committed to the repository.


## Implementation progress — backend foundation

The first isolated backend module is now present at `like-duel-backend/imposter/index.js` and registered on the existing authenticated Socket.IO server.

### Implemented event contract

Client → server (all events are scoped to the authenticated `socket.data.tgId`):

- `imposter:create_room` — create a six-character invite room.
- `imposter:join_room` — join an open lobby by code.
- `imposter:set_ready` — set the current player's ready state.
- `imposter:start_game` — host starts when at least three players are ready.
- `imposter:get_state` — restore room state and the requesting player's private role after reconnect.
- `imposter:submit_clue` — submit one short clue during the clue phase.
- `imposter:advance_phase` — host advances clue → discussion → voting.
- `imposter:vote` — one vote per authenticated player during voting.
- `imposter:leave_room` — leave a lobby; host ownership transfers when needed.

Server → client:

- `imposter:room_updated` — allow-listed public room snapshot.
- `imposter:private_role` — private role/word for the receiving player only.
- `imposter:vote_progress` — aggregate vote count only.
- `imposter:game_result` — final result after all active room players have voted.

### Security properties

- Identity comes from existing verified Socket.IO auth middleware; client-supplied user IDs are not accepted as authority.
- Public room snapshots never serialize the secret word, role, or per-player secret word.
- The assigned word/role is emitted directly to the matching player's socket.
- Room membership, host-only actions, phase, self-voting, target membership and duplicate voting are checked server-side.
- Imposter data uses its own Mongoose model/collection and does not mutate Like Duel wallet, rating or statistics.

### Current MVP boundaries

- Three to twelve human players; one Imposter; a small built-in Uzbek word/category set.
- Clues, discussion and voting are implemented as server-validated phases; no automatic round timer yet.
- No AI players, Telegram group bot commands, local pass-and-play, full frontend room screens or multilingual word packs yet.
- The Node test suite includes public-state secrecy checks. It has been authored but not executed in a local runtime yet.
