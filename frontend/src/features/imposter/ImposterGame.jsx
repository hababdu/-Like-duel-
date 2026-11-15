import React, { useCallback, useEffect, useState } from 'react';
import './ImposterGame.css';

const PHASE_LABELS = {
  lobby: 'Kutish xonasi',
  clue: 'Maslahatlar',
  discussion: 'Muhokama',
  voting: 'Ovoz berish',
  results: 'Natijalar'
};

export default function ImposterGame({ socket, user, onBack, onNotification }) {
  const [room, setRoom] = useState(null);
  const [privateRole, setPrivateRole] = useState(null);
  const [result, setResult] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [clue, setClue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [voted, setVoted] = useState(false);

  const request = useCallback((event, payload = {}) => new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Server bilan aloqa yo‘q. Internetni tekshiring.'));
      return;
    }
    socket.timeout(10000).emit(event, payload, (timeoutError, response) => {
      if (timeoutError) return reject(new Error('Server javob bermadi. Qayta urinib ko‘ring.'));
      if (!response?.ok) return reject(new Error(response?.error?.message || 'Amal bajarilmadi.'));
      resolve(response);
    });
  }), [socket]);

  const run = useCallback(async (event, payload = {}) => {
    setBusy(true);
    setError('');
    try {
      const response = await request(event, payload);
      if (response.room) setRoom(response.room);
      if (response.privateRole) setPrivateRole(response.privateRole);
      if (response.result) setResult(response.result);
      if (event === 'imposter:vote') setVoted(true);
      return response;
    } catch (err) {
      setError(err.message);
      onNotification?.(err.message, 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }, [request, onNotification]);

  useEffect(() => {
    const onRoom = (state) => setRoom(state);
    const onRole = (role) => setPrivateRole(role);
    const onResult = (data) => {
      setResult(data);
      if (data.room) setRoom(data.room);
    };
    const onProgress = () => {};
    socket.on('imposter:room_updated', onRoom);
    socket.on('imposter:private_role', onRole);
    socket.on('imposter:game_result', onResult);
    socket.on('imposter:vote_progress', onProgress);
    return () => {
      socket.off('imposter:room_updated', onRoom);
      socket.off('imposter:private_role', onRole);
      socket.off('imposter:game_result', onResult);
      socket.off('imposter:vote_progress', onProgress);
    };
  }, [socket]);

  useEffect(() => {
    if (room?.roomCode) {
      setVoted(false);
      setResult(null);
      run('imposter:get_state', { roomCode: room.roomCode });
    }
    // Only refresh when a new room is first assigned by create/join.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.roomCode]);

  const createRoom = async () => {
    const response = await run('imposter:create_room');
    if (response?.room) onNotification?.('Xona yaratildi. Do‘stlaringizga kodni yuboring.', 'success');
  };

  const joinRoom = async () => {
    const response = await run('imposter:join_room', { roomCode });
    if (response?.room) onNotification?.('Xonaga muvaffaqiyatli qo‘shildingiz.', 'success');
  };

  const leaveRoom = async () => {
    await run('imposter:leave_room', { roomCode: room.roomCode });
    setRoom(null);
    setPrivateRole(null);
    setResult(null);
    setRoomCode('');
  };

  const startGame = async () => {
    setPrivateRole(null);
    await run('imposter:start_game', { roomCode: room.roomCode });
  };

  const advance = async () => {
    await run('imposter:advance_phase', { roomCode: room.roomCode });
  };

  const submitClue = async () => {
    const response = await run('imposter:submit_clue', { roomCode: room.roomCode, clue });
    if (response?.ok) setClue('');
  };

  const vote = async (targetId) => {
    await run('imposter:vote', { roomCode: room.roomCode, targetId });
  };

  const myId = String(user?.tgId || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '');
  const me = room?.players?.find((player) => player.tgId === myId);
  const isHost = Boolean(me?.isHost);
  const myClue = Boolean(me?.clue);
  const nextPhase = { clue: 'discussion', discussion: 'voting' }[room?.phase];

  return (
    <main className="imposter-screen">
      <header className="imposter-header">
        <button className="imposter-back" onClick={onBack} aria-label="Orqaga">←</button>
        <div><span className="imposter-kicker">HIDDEN ROLE GAME</span><h2>Imposter</h2></div>
        <span className="imposter-status">{socket?.connected ? '● ONLINE' : '● OFFLINE'}</span>
      </header>

      {!room ? (
        <section className="imposter-panel">
          <div className="imposter-hero"><span>🕵️</span><h3>Kim Imposter?</h3><p>Do‘stlaringiz bilan xona yarating yoki taklif kodini kiriting.</p></div>
          <button className="imposter-primary" disabled={busy || !socket?.connected} onClick={createRoom}>＋ Yangi xona yaratish</button>
          <div className="imposter-separator"><span>YOKI KOD ORQALI KIRISH</span></div>
          <label className="imposter-label" htmlFor="imposter-room-code">Xona kodi</label>
          <input id="imposter-room-code" className="imposter-input" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 6))} placeholder="MASALAN: AB23CD" maxLength={6} />
          <button className="imposter-secondary" disabled={busy || roomCode.length !== 6 || !socket?.connected} onClick={joinRoom}>Xonaga qo‘shilish</button>
          <p className="imposter-hint">O‘yin uchun kamida 3 nafar ishtirokchi kerak.</p>
        </section>
      ) : (
        <>
          <section className="imposter-room-banner">
            <div><span className="imposter-kicker">XONA KODI</span><strong>{room.roomCode}</strong></div>
            <button onClick={() => navigator.clipboard?.writeText(room.roomCode).then(() => onNotification?.('Xona kodi nusxalandi.', 'success')).catch(() => {})}>Nusxalash</button>
          </section>

          <section className="imposter-panel">
            <div className="imposter-section-title"><h3>{PHASE_LABELS[room.phase] || 'O‘yin'}</h3><span>{room.playerCount}/{room.maxPlayers} o‘yinchi</span></div>
            {room.phase === 'lobby' ? (
              <>
                <p className="imposter-hint">Barcha ishtirokchilar tayyor bo‘lgach, xona egasi o‘yinni boshlaydi.</p>
                <div className="imposter-player-list">
                  {room.players.map((player, index) => (
                    <div className="imposter-player" key={player.tgId}>
                      <span className="imposter-player-avatar">{player.isHost ? '♛' : '●'}</span>
                      <span className="imposter-player-name">{player.displayName || `O‘yinchi ${index + 1}`}{player.tgId === myId ? ' (Siz)' : ''}</span>
                      <span className={`imposter-ready ${player.isReady ? 'is-ready' : ''}`}>{player.isReady ? 'TAYYOR' : 'KUTMOQDA'}</span>
                    </div>
                  ))}
                </div>
                <button className="imposter-secondary" disabled={busy} onClick={() => run('imposter:set_ready', { roomCode: room.roomCode, isReady: !me?.isReady })}>{me?.isReady ? 'Tayyor emasman' : 'Men tayyorman'}</button>
                {isHost && <button className="imposter-primary" disabled={busy || room.playerCount < room.minPlayers || room.players.some((p) => !p.isReady)} onClick={startGame}>O‘yinni boshlash</button>}
                <button className="imposter-quiet" disabled={busy} onClick={leaveRoom}>Xonadan chiqish</button>
              </>
            ) : (
              <>
                {privateRole && <div className={`imposter-secret ${privateRole.role === 'imposter' ? 'is-imposter' : ''}`}>
                  <span>SIZNING YASHIRIN ROLINGIZ</span>
                  <strong>{privateRole.role === 'imposter' ? 'IMPOSTER' : 'ODDIY O‘YINCHI'}</strong>
                  {privateRole.role === 'imposter' ? <p>Siz maxfiy so‘zni bilmaysiz. Boshqalarning maslahatlaridan so‘zni topishga harakat qiling.</p> : <p className="imposter-secret-word">{privateRole.word}</p>}
                  <small>Kategoriya: {privateRole.category}</small>
                </div>}
                {!privateRole && <p className="imposter-hint">Maxfiy rolingiz yuklanmoqda. Server bilan aloqa tiklanishini kuting.</p>}
                {room.phase === 'clue' && <div className="imposter-action">
                  <label className="imposter-label" htmlFor="imposter-clue">So‘zga oid qisqa maslahat</label>
                  <input id="imposter-clue" className="imposter-input" maxLength={80} value={clue} onChange={(e) => setClue(e.target.value)} placeholder="Maslahat yozing..." />
                  <button className="imposter-secondary" disabled={busy || !clue.trim() || myClue} onClick={submitClue}>{myClue ? 'Maslahat yuborildi' : 'Maslahatni yuborish'}</button>
                  {isHost && <button className="imposter-primary" disabled={busy} onClick={advance}>Muhokamaga o‘tish</button>}
                </div>}
                {room.phase === 'discussion' && <>
                  <div className="imposter-clues"><h4>O‘yinchilar maslahatlari</h4>{room.players.map((p) => <p key={p.tgId}><b>{p.displayName}</b><span>{p.clue || 'Hali maslahat yo‘q'}</span></p>)}</div>
                  {isHost && <button className="imposter-primary" disabled={busy} onClick={advance}>Ovoz berishga o‘tish</button>}
                </>}
                {room.phase === 'voting' && <>
                  <h4 className="imposter-subheading">Kim Imposter deb o‘ylaysiz?</h4>
                  <div className="imposter-player-list">{room.players.filter((p) => p.tgId !== myId).map((p) => <button className="imposter-vote" key={p.tgId} disabled={busy || voted} onClick={() => vote(p.tgId)}><span>{p.displayName}</span><b>{voted ? 'OVOZ BERILDI' : 'TANLASH →'}</b></button>)}</div>
                  <p className="imposter-hint">{room.votesSubmitted} / {room.playerCount} ovoz berildi</p>
                </>}
                {room.phase === 'results' && result && <div className="imposter-result"><h3>{result.winner === 'crew' ? '🎉 Jamoa g‘alaba qozondi!' : '🕵️ Imposter g‘alaba qozondi!'}</h3><p>Chiqarilgan o‘yinchi: {room.players.find((p) => p.tgId === result.eliminatedPlayerId)?.displayName || 'Aniqlanmadi'}</p></div>}
              </>
            )}
          </section>
        </>
      )}
      {error && <p className="imposter-error" role="alert">{error}</p>}
      <p className="imposter-footer">LIKE DUEL GAME HUB · IMPOSTER</p>
    </main>
  );
}
