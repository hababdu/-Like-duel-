import test from 'node:test';
import assert from 'node:assert/strict';
import { ImposterRoom, publicRoom } from './index.js';

test('public room snapshot never exposes secret word or player roles', () => {
  const room = new ImposterRoom({
    roomCode: 'ABCD23',
    hostId: '1001',
    status: 'active',
    phase: 'clue',
    category: 'Kasblar',
    word: 'Shifokor',
    players: [
      { tgId: '1001', displayName: 'Player 1', isHost: true, isReady: true, role: 'player', secretWord: 'Shifokor' },
      { tgId: '1002', displayName: 'Player 2', isHost: false, isReady: true, role: 'imposter', secretWord: '' }
    ],
    votes: []
  });

  const snapshot = publicRoom(room);
  assert.equal(snapshot.category, 'Kasblar');
  assert.equal(snapshot.players.length, 2);
  assert.equal(snapshot.word, undefined);
  for (const player of snapshot.players) {
    assert.equal(player.role, undefined);
    assert.equal(player.secretWord, undefined);
  }
});

test('public room only exposes submitted clues after clue phase ends', () => {
  const room = new ImposterRoom({
    roomCode: 'ABCD23',
    hostId: '1001',
    status: 'active',
    phase: 'clue',
    players: [{ tgId: '1001', displayName: 'Player 1', clue: 'Issiq' }],
    votes: []
  });

  assert.equal(publicRoom(room).players[0].clue, undefined);
  room.phase = 'discussion';
  assert.equal(publicRoom(room).players[0].clue, 'Issiq');
});
