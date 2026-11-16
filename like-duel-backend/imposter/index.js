import mongoose from 'mongoose';
import crypto from 'crypto';

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const ROOM_CODE_LENGTH = 6;
const WORD_PAIRS = [
  { category: 'Hayvonlar', word: 'Yo‘lbars' },
  { category: 'Kasblar', word: 'Shifokor' },
  { category: 'Davlatlar', word: 'Yaponiya' },
  { category: 'Taomlar', word: 'Osh' },
  { category: 'Transport', word: 'Poyezd' },
  { category: 'Tabiat', word: 'Sharshara' },
  { category: 'Sport', word: 'Basketbol' },
  { category: 'Buyumlar', word: 'Soyabon' }
];

const PlayerSchema = new mongoose.Schema({
  tgId: { type: String, required: true },
  displayName: { type: String, required: true },
  isHost: { type: Boolean, default: false },
  isReady: { type: Boolean, default: false },
  clue: { type: String, default: '' },
  socketId: { type: String, default: '' },
  role: { type: String, enum: ['player', 'imposter'], default: 'player' },
  secretWord: { type: String, default: '' },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const VoteSchema = new mongoose.Schema({
  voterId: { type: String, required: true },
  targetId: { type: String, required: true }
}, { _id: false });

const ImposterRoomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true, index: true },
  hostId: { type: String, required: true, index: true },
  matchingSize: { type: Number, min: MIN_PLAYERS, max: MAX_PLAYERS, default: null },
  matchKey: { type: String, unique: true, sparse: true },
  status: { type: String, enum: ['lobby', 'active', 'finished'], default: 'lobby', index: true },
  phase: { type: String, enum: ['lobby', 'clue', 'discussion', 'voting', 'results'], default: 'lobby' },
  category: { type: String, default: '' },
  word: { type: String, default: '' },
  players: { type: [PlayerSchema], default: [] },
  votes: { type: [VoteSchema], default: [] },
  winner: { type: String, enum: ['crew', 'imposter', ''], default: '' },
  createdAt: { type: Date, default: Date.now },
  startedAt: { type: Date, default: null },
  finishedAt: { type: Date, default: null }
}, { timestamps: true });

const ImposterRoom = mongoose.models.ImposterRoom
  || mongoose.model('ImposterRoom', ImposterRoomSchema);

function makeRoomCode() {
  // Avoid ambiguous characters (0/O and 1/I).
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return code;
}

function publicRoom(room) {
  return {
    roomCode: room.roomCode,
    status: room.status,
    phase: room.phase,
    category: room.category,
    hostId: room.hostId,
    matchingSize: room.matchingSize || null,
    isMatchmaking: Boolean(room.matchingSize),
    players: room.players.map((player) => ({
      tgId: player.tgId,
      displayName: player.displayName,
      isHost: player.isHost,
      isReady: player.isReady,
      ...(room.phase !== 'clue' ? { clue: player.clue } : {})
    })),
    playerCount: room.players.length,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    votesSubmitted: room.votes.length,
    winner: room.status === 'finished' ? room.winner : ''
  };
}

function resultFor(room) {
  if (room.status !== 'finished') return null;
  const counts = new Map();
  room.votes.forEach((vote) => counts.set(vote.targetId, (counts.get(vote.targetId) || 0) + 1));
  const maxVotes = counts.size ? Math.max(...counts.values()) : 0;
  const leaders = [...counts.entries()].filter(([, count]) => count === maxVotes).map(([id]) => id);
  const eliminatedId = leaders.length === 1 ? leaders[0] : null;
  const eliminated = eliminatedId ? room.players.find((player) => player.tgId === eliminatedId) : null;
  return {
    winner: room.winner,
    eliminatedPlayerId: eliminatedId,
    eliminatedRole: eliminated?.role || 'unknown'
  };
}

function privateRole(room, tgId) {
  const player = room.players.find((item) => item.tgId === tgId);
  if (!player || room.status !== 'active') return null;
  return {
    role: player.role,
    word: player.role === 'imposter' ? null : player.secretWord,
    category: room.category
  };
}

function emitRoom(io, room) {
  io.to(room.roomCode).emit('imposter:room_updated', publicRoom(room));
}

function reply(ack, payload) {
  if (typeof ack === 'function') ack(payload);
}

function fail(ack, code, message) {
  reply(ack, { ok: false, error: { code, message } });
}

function playerName(tgId) {
  return `O‘yinchi ${tgId.slice(-4)}`;
}

async function findPlayerRoom(tgId, roomCode) {
  const query = roomCode
    ? { roomCode: String(roomCode).trim().toUpperCase(), 'players.tgId': tgId }
    : { 'players.tgId': tgId, status: { $in: ['lobby', 'active'] } };
  return ImposterRoom.findOne(query);
}


async function startMatchedGame(io, room) {
  if (!room || room.status !== 'lobby' || !room.matchingSize || room.players.length !== room.matchingSize) return null;
  const selected = WORD_PAIRS[crypto.randomInt(0, WORD_PAIRS.length)];
  const imposterIndex = crypto.randomInt(0, room.players.length);
  const players = room.players.map((player, index) => ({
    ...player.toObject(),
    isReady: true,
    role: index === imposterIndex ? 'imposter' : 'player',
    secretWord: index === imposterIndex ? '' : selected.word,
    clue: ''
  }));
  const started = await ImposterRoom.findOneAndUpdate(
    { _id: room._id, status: 'lobby', matchingSize: room.matchingSize, $expr: { $eq: [{ $size: '$players' }, room.matchingSize] } },
    { $set: { status: 'active', phase: 'clue', category: selected.category, word: selected.word, players, votes: [], startedAt: new Date() }, $unset: { matchKey: 1 } },
    { new: true }
  );
  if (!started) return null;
  for (const player of started.players) {
    const recipient = io.sockets.sockets.get(player.socketId);
    if (recipient) recipient.emit('imposter:private_role', privateRole(started, player.tgId));
  }
  emitRoom(io, started);
  io.to(started.roomCode).emit('imposter:match_found', { room: publicRoom(started) });
  return started;
}

export function registerImposterHandlers(io) {
  io.on('connection', (socket) => {
    const tgId = String(socket.data.tgId || '');
    if (!tgId) return;


    socket.on('imposter:find_match', async (payload = {}, ack) => {
      try {
        const requestedSize = Number(payload.playerCount);
        if (!Number.isInteger(requestedSize) || requestedSize < MIN_PLAYERS || requestedSize > MAX_PLAYERS) {
          return fail(ack, 'INVALID_PLAYER_COUNT', `O‘yinchilar soni ${MIN_PLAYERS} dan ${MAX_PLAYERS} gacha bo‘lishi kerak.`);
        }
        const existing = await findPlayerRoom(tgId);
        if (existing) return fail(ack, 'ALREADY_IN_ROOM', 'Siz allaqachon faol xona yoki navbatdasiz.');
        let room = await ImposterRoom.findOneAndUpdate(
          { status: 'lobby', matchingSize: requestedSize, matchKey: `match:${requestedSize}`, 'players.tgId': { $ne: tgId }, $expr: { $lt: [{ $size: '$players' }, requestedSize] } },
          { $push: { players: { tgId, displayName: playerName(tgId), isReady: true, socketId: socket.id } } },
          { new: true, sort: { createdAt: 1 } }
        );
        if (!room) {
          try {
            room = await ImposterRoom.create({
              roomCode: makeRoomCode(),
              hostId: tgId,
              matchingSize: requestedSize,
              matchKey: `match:${requestedSize}`,
              players: [{ tgId, displayName: playerName(tgId), isHost: true, isReady: true, socketId: socket.id }]
            });
          } catch (error) {
            if (error?.code !== 11000) throw error;
            room = await ImposterRoom.findOneAndUpdate(
              { status: 'lobby', matchingSize: requestedSize, matchKey: `match:${requestedSize}`, 'players.tgId': { $ne: tgId }, $expr: { $lt: [{ $size: '$players' }, requestedSize] } },
              { $push: { players: { tgId, displayName: playerName(tgId), isReady: true, socketId: socket.id } } },
              { new: true, sort: { createdAt: 1 } }
            );
            if (!room) throw error;
          }
        }
        await socket.join(room.roomCode);
        emitRoom(io, room);
        const started = await startMatchedGame(io, room);
        const latest = started || room;
        reply(ack, { ok: true, room: publicRoom(latest), waiting: !started, playerCount: latest.players.length, matchingSize: requestedSize });
      } catch (error) {
        console.error('[Imposter] find_match:', error.message);
        fail(ack, 'MATCH_FAILED', 'Mos o‘yinchilarni topib bo‘lmadi. Qayta urinib ko‘ring.');
      }
    });

    socket.on('imposter:create_room', async (payload = {}, ack) => {
      try {
        const existing = await findPlayerRoom(tgId);
        if (existing) return fail(ack, 'ALREADY_IN_ROOM', 'Siz allaqachon faol xonadasiz.');
        let room;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            room = await ImposterRoom.create({
              roomCode: makeRoomCode(),
              hostId: tgId,
              players: [{ tgId, displayName: playerName(tgId), isHost: true, isReady: false, socketId: socket.id }]
            });
            break;
          } catch (error) {
            if (error?.code !== 11000 || attempt === 4) throw error;
          }
        }
        await socket.join(room.roomCode);
        const state = publicRoom(room);
        reply(ack, { ok: true, room: state });
        socket.emit('imposter:room_updated', state);
      } catch (error) {
        console.error('[Imposter] create_room:', error.message);
        fail(ack, 'CREATE_FAILED', 'Xona yaratib bo‘lmadi. Qayta urinib ko‘ring.');
      }
    });

    socket.on('imposter:join_room', async (payload = {}, ack) => {
      try {
        const code = String(payload.roomCode || '').trim().toUpperCase();
        if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return fail(ack, 'INVALID_CODE', 'Xona kodi noto‘g‘ri.');
        const existing = await findPlayerRoom(tgId);
        if (existing) {
          if (existing.roomCode !== code) return fail(ack, 'ALREADY_IN_ROOM', 'Avval joriy xonadan chiqing.');
          await socket.join(code);
          await ImposterRoom.updateOne({ roomCode: code, 'players.tgId': tgId }, { $set: { 'players.$.socketId': socket.id } });
          const refreshed = await ImposterRoom.findOne({ roomCode: code });
          reply(ack, { ok: true, room: publicRoom(refreshed), privateRole: privateRole(refreshed, tgId) });
          socket.emit('imposter:room_updated', publicRoom(refreshed));
          return;
        }
        const room = await ImposterRoom.findOneAndUpdate(
          { roomCode: code, status: 'lobby', $expr: { $lt: [{ $size: '$players' }, MAX_PLAYERS] }, 'players.tgId': { $ne: tgId } },
          { $push: { players: { tgId, displayName: playerName(tgId), isReady: false, socketId: socket.id } } },
          { new: true }
        );
        if (!room) return fail(ack, 'ROOM_UNAVAILABLE', 'Xona topilmadi yoki unga qo‘shilish mumkin emas.');
        await socket.join(code);
        emitRoom(io, room);
        reply(ack, { ok: true, room: publicRoom(room) });
      } catch (error) {
        console.error('[Imposter] join_room:', error.message);
        fail(ack, 'JOIN_FAILED', 'Xonaga qo‘shilib bo‘lmadi.');
      }
    });

    socket.on('imposter:set_ready', async (payload = {}, ack) => {
      try {
        const room = await findPlayerRoom(tgId, payload.roomCode);
        if (!room || room.status !== 'lobby') return fail(ack, 'ROOM_NOT_FOUND', 'Faol kutish xonasi topilmadi.');
        const result = await ImposterRoom.updateOne(
          { _id: room._id, status: 'lobby', 'players.tgId': tgId },
          { $set: { 'players.$.isReady': Boolean(payload.isReady), 'players.$.socketId': socket.id } }
        );
        const updated = await ImposterRoom.findById(room._id);
        emitRoom(io, updated);
        reply(ack, { ok: true, room: publicRoom(updated) });
      } catch (error) {
        console.error('[Imposter] set_ready:', error.message);
        fail(ack, 'READY_FAILED', 'Tayyorlik holati saqlanmadi.');
      }
    });

    socket.on('imposter:start_game', async (payload = {}, ack) => {
      try {
        const room = await findPlayerRoom(tgId, payload.roomCode);
        if (!room || room.status !== 'lobby') return fail(ack, 'ROOM_NOT_FOUND', 'Kutish xonasi topilmadi.');
        if (room.hostId !== tgId) return fail(ack, 'HOST_ONLY', 'O‘yinni faqat xona egasi boshlashi mumkin.');
        if (room.players.length < MIN_PLAYERS) return fail(ack, 'NOT_ENOUGH_PLAYERS', `O‘yinni boshlash uchun kamida ${MIN_PLAYERS} o‘yinchi kerak.`);
        if (room.players.some((player) => !player.isReady)) return fail(ack, 'PLAYERS_NOT_READY', 'Barcha o‘yinchilar tayyor bo‘lishi kerak.');

        const selected = WORD_PAIRS[crypto.randomInt(0, WORD_PAIRS.length)];
        const imposterIndex = crypto.randomInt(0, room.players.length);
        const players = room.players.map((player, index) => ({
          ...player.toObject(),
          role: index === imposterIndex ? 'imposter' : 'player',
          secretWord: index === imposterIndex ? '' : selected.word,
          clue: ''
        }));
        const started = await ImposterRoom.findOneAndUpdate(
          { _id: room._id, status: 'lobby', hostId: tgId },
          { $set: { status: 'active', phase: 'clue', category: selected.category, word: selected.word, players, votes: [], startedAt: new Date() } },
          { new: true }
        );
        if (!started) return fail(ack, 'START_CONFLICT', 'O‘yin holati o‘zgardi. Xonani yangilang.');
        for (const player of started.players) {
          const recipient = io.sockets.sockets.get(player.socketId);
          if (recipient) recipient.emit('imposter:private_role', privateRole(started, player.tgId));
        }
        emitRoom(io, started);
        reply(ack, { ok: true, room: publicRoom(started) });
      } catch (error) {
        console.error('[Imposter] start_game:', error.message);
        fail(ack, 'START_FAILED', 'O‘yinni boshlab bo‘lmadi.');
      }
    });

    socket.on('imposter:get_state', async (payload = {}, ack) => {
      try {
        const room = await findPlayerRoom(tgId, payload.roomCode);
        if (!room) return fail(ack, 'ROOM_NOT_FOUND', 'Siz uchun faol xona topilmadi.');
        await socket.join(room.roomCode);
        await ImposterRoom.updateOne({ _id: room._id, 'players.tgId': tgId }, { $set: { 'players.$.socketId': socket.id } });
        const refreshed = await ImposterRoom.findById(room._id);
        const state = publicRoom(refreshed);
        const role = privateRole(refreshed, tgId);
        socket.emit('imposter:room_updated', state);
        if (role) socket.emit('imposter:private_role', role);
        reply(ack, { ok: true, room: state, privateRole: role, result: resultFor(refreshed) });
      } catch (error) {
        console.error('[Imposter] get_state:', error.message);
        fail(ack, 'STATE_FAILED', 'Xona ma’lumotini olib bo‘lmadi.');
      }
    });

    socket.on('imposter:submit_clue', async (payload = {}, ack) => {
      try {
        const room = await findPlayerRoom(tgId, payload.roomCode);
        if (!room || room.status !== 'active' || room.phase !== 'clue') return fail(ack, 'CLUE_CLOSED', 'Maslahat yuborish vaqti emas.');
        const clue = String(payload.clue || '').trim().slice(0, 80);
        if (!clue) return fail(ack, 'EMPTY_CLUE', 'Maslahat matnini kiriting.');
        const updated = await ImposterRoom.findOneAndUpdate(
          { _id: room._id, status: 'active', phase: 'clue', players: { $elemMatch: { tgId, clue: '' } } },
          { $set: { 'players.$.clue': clue } },
          { new: true }
        );
        if (!updated) return fail(ack, 'CLUE_ALREADY_SENT', 'Siz maslahat yuborib bo‘lgansiz.');
        emitRoom(io, updated);
        reply(ack, { ok: true, submitted: true });
      } catch (error) {
        console.error('[Imposter] submit_clue:', error.message);
        fail(ack, 'CLUE_FAILED', 'Maslahatni saqlab bo‘lmadi.');
      }
    });

    socket.on('imposter:advance_phase', async (payload = {}, ack) => {
      try {
        const room = await findPlayerRoom(tgId, payload.roomCode);
        if (!room || room.status !== 'active') return fail(ack, 'GAME_NOT_ACTIVE', 'O‘yin faol emas.');
        if (room.hostId !== tgId) return fail(ack, 'HOST_ONLY', 'Bosqichni faqat xona egasi o‘zgartiradi.');
        const next = { clue: 'discussion', discussion: 'voting' }[room.phase];
        if (!next) return fail(ack, 'INVALID_PHASE', 'Bu bosqichdan keyin o‘tib bo‘lmaydi.');
        const updated = await ImposterRoom.findOneAndUpdate(
          { _id: room._id, status: 'active', phase: room.phase, hostId: tgId },
          { $set: { phase: next, ...(next === 'voting' ? { votes: [] } : {}) } },
          { new: true }
        );
        if (!updated) return fail(ack, 'PHASE_CONFLICT', 'O‘yin bosqichi o‘zgargan. Holatni yangilang.');
        emitRoom(io, updated);
        reply(ack, { ok: true, room: publicRoom(updated) });
      } catch (error) {
        console.error('[Imposter] advance_phase:', error.message);
        fail(ack, 'PHASE_FAILED', 'O‘yin bosqichini o‘zgartirib bo‘lmadi.');
      }
    });

    socket.on('imposter:vote', async (payload = {}, ack) => {
      try {
        const room = await findPlayerRoom(tgId, payload.roomCode);
        if (!room || room.status !== 'active' || room.phase !== 'voting') return fail(ack, 'VOTING_CLOSED', 'Ovoz berish hozir ochiq emas.');
        const targetId = String(payload.targetId || '');
        if (!room.players.some((p) => p.tgId === targetId)) return fail(ack, 'INVALID_TARGET', 'Tanlangan o‘yinchi bu xonada yo‘q.');
        if (targetId === tgId) return fail(ack, 'SELF_VOTE', 'O‘zingizga ovoz bera olmaysiz.');
        const updated = await ImposterRoom.findOneAndUpdate(
          { _id: room._id, status: 'active', phase: 'voting', 'players.tgId': tgId, 'votes.voterId': { $ne: tgId } },
          { $push: { votes: { voterId: tgId, targetId } } },
          { new: true }
        );
        if (!updated) return fail(ack, 'ALREADY_VOTED', 'Siz ovoz berib bo‘lgansiz.');
        const publicState = publicRoom(updated);
        io.to(updated.roomCode).emit('imposter:vote_progress', { votesSubmitted: updated.votes.length, totalPlayers: updated.players.length });
        if (updated.votes.length === updated.players.length) {
          const counts = new Map();
          updated.votes.forEach((vote) => counts.set(vote.targetId, (counts.get(vote.targetId) || 0) + 1));
          const maxVotes = Math.max(...counts.values());
          const leaders = [...counts.entries()].filter(([, count]) => count === maxVotes).map(([id]) => id);
          const eliminatedId = leaders.length === 1 ? leaders[0] : null;
          const eliminated = eliminatedId ? updated.players.find((p) => p.tgId === eliminatedId) : null;
          const winner = eliminated?.role === 'imposter' ? 'crew' : 'imposter';
          const finished = await ImposterRoom.findOneAndUpdate(
            { _id: updated._id, status: 'active', phase: 'voting', 'votes.voterId': { $exists: true } },
            { $set: { status: 'finished', phase: 'results', winner, finishedAt: new Date() } },
            { new: true }
          );
          if (finished) {
            io.to(finished.roomCode).emit('imposter:game_result', {
              winner,
              eliminatedPlayerId: eliminatedId,
              eliminatedRole: eliminated?.role || 'unknown',
              votes: finished.votes.map((vote) => ({ targetId: vote.targetId })),
              room: publicRoom(finished)
            });
          }
        }
        reply(ack, { ok: true, votesSubmitted: updated.votes.length, room: publicState });
      } catch (error) {
        console.error('[Imposter] vote:', error.message);
        fail(ack, 'VOTE_FAILED', 'Ovoz saqlanmadi. Qayta urinib ko‘ring.');
      }
    });

    socket.on('imposter:leave_room', async (payload = {}, ack) => {
      try {
        const room = await findPlayerRoom(tgId, payload.roomCode);
        if (!room) return reply(ack, { ok: true });
        if (room.status !== 'lobby') return fail(ack, 'GAME_IN_PROGRESS', 'O‘yin boshlanganidan keyin xonani tark etib bo‘lmaydi.');
        const remaining = room.players.filter((player) => player.tgId !== tgId);
        if (!remaining.length) {
          await ImposterRoom.deleteOne({ _id: room._id, status: 'lobby' });
          socket.leave(room.roomCode);
          return reply(ack, { ok: true, deleted: true });
        }
        const nextHost = room.hostId === tgId ? remaining[0].tgId : room.hostId;
        const updatedPlayers = remaining.map((player) => ({
          ...player.toObject(),
          isHost: player.tgId === nextHost
        }));
        const updated = await ImposterRoom.findOneAndUpdate(
          { _id: room._id, status: 'lobby' },
          { $set: { players: updatedPlayers, hostId: nextHost } },
          { new: true }
        );
        socket.leave(room.roomCode);
        emitRoom(io, updated);
        reply(ack, { ok: true, room: publicRoom(updated) });
      } catch (error) {
        console.error('[Imposter] leave_room:', error.message);
        fail(ack, 'LEAVE_FAILED', 'Xonadan chiqib bo‘lmadi.');
      }
    });

    socket.on('disconnect', async () => {
      try {
        const room = await findPlayerRoom(tgId);
        if (!room || room.status !== 'lobby') return;
        await ImposterRoom.updateOne({ _id: room._id, 'players.tgId': tgId, 'players.socketId': socket.id }, { $set: { 'players.$.socketId': '' } });
      } catch (error) {
        console.error('[Imposter] disconnect cleanup:', error.message);
      }
    });
  });
}

export { ImposterRoom, publicRoom };
