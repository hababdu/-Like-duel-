import React, { useEffect, useState } from 'react';
import './JumanjiGame.css';

const request = (socket, event, payload={}) => new Promise((resolve,reject)=>{
  if(!socket?.connected)return reject(new Error('Server bilan aloqa yo‘q.'));
  socket.timeout(10000).emit(event,payload,(err,res)=>{
    if(err)return reject(new Error('Server javob bermadi.'));
    if(!res?.ok)return reject(new Error(res?.error?.message||'Amal bajarilmadi.'));
    resolve(res);
  });
});

export default function JumanjiGame({socket,user,onBack,onNotification}){
  const [room,setRoom]=useState(null);
  const [code,setCode]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [answer,setAnswer]=useState(null);
  const me=room?.players?.find(p=>p.tgId===String(user?.tgId));
  const isHost=room?.hostId===String(user?.tgId);
  const current=room?.players?.[room?.turnIndex];
  const act=async(event,payload={})=>{
    setBusy(true);setError('');
    try{
      const res=await request(socket,event,payload);
      if(res.room){
        setRoom(res.room);
        if(['jumanji:create','jumanji:join','jumanji:resume'].includes(event)) {
          try { window.localStorage.setItem('jumanjiRoomCode:'+String(user?.tgId),res.room.code); } catch {}
        }
      }
      if(event==='jumanji:leave') {
        try { window.localStorage.removeItem('jumanjiRoomCode:'+String(user?.tgId)); } catch {}
      }
      if(res.correct!==undefined)onNotification?.(res.correct?'To‘g‘ri javob!':'Bu safar noto‘g‘ri javob.','info');
      return res;
    }
    catch(e){setError(e.message);onNotification?.(e.message,'error');return null;}
    finally{setBusy(false);}
  };
  useEffect(()=>{
    const update=data=>setRoom(data);
    const resume=()=>{
      if(room) return;
      let saved='';
      try { saved=window.localStorage.getItem('jumanjiRoomCode:'+String(user?.tgId))||''; } catch {}
      if(saved) request(socket,'jumanji:resume',{code:saved}).then(res=>setRoom(res.room)).catch(()=>{});
    };
    socket.on('jumanji:updated',update);
    socket.on('connect',resume);
    if(socket.connected) resume();
    return()=>{
      socket.off('jumanji:updated',update);
      socket.off('connect',resume);
    };
  },[socket,user?.tgId]);
  const hero=room?.heroes?.find(h=>h.id===me?.heroId);
  return <main className="jumanji-screen">
    <header className="jumanji-header"><button onClick={onBack}>←</button><div><span>LIKE DUEL · ADVENTURE</span><h2>Jumanji: Sirli O‘rmon</h2></div><b>🌿</b></header>
    {!room?<section className="jumanji-panel">
      <div className="jumanji-hero-art">🌴 🐾 🌿</div><h3>Sarguzasht boshlansin!</h3>
      <p>Do‘stlaringiz bilan xarita bo‘ylab yuring, jumboqlarni yeching va marraga birinchi yetib boring.</p>
      <button className="jumanji-primary" disabled={busy||!socket.connected} onClick={()=>act('jumanji:create')}>＋ Yangi xona yaratish</button>
      <div className="jumanji-divider">YOKI XONA KODI</div>
      <input value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,'').slice(0,6))} placeholder="6 xonali kod" maxLength={6}/>
      <button className="jumanji-secondary" disabled={busy||code.length!==6||!socket.connected} onClick={()=>act('jumanji:join',{code})}>Xonaga qo‘shilish</button>
      <small>2–8 nafar o‘yinchi · Birgalikdagi sarguzasht</small>
    </section>:<>
      <section className="jumanji-roomtop"><div><small>XONA KODI</small><strong>{room.code}</strong></div><span>{room.players.length}/8 o‘yinchi</span></section>
      <section className="jumanji-panel">
        <h3>{room.status==='lobby'?'Qahramoningizni tanlang':'Sarguzasht xaritasi'}</h3>
        {room.status==='lobby'?<>
          <div className="jumanji-heroes">{room.heroes.map(h=><button key={h.id} className={me?.heroId===h.id?'selected':''} disabled={busy} onClick={()=>act('jumanji:choose_hero',{code:room.code,heroId:h.id})}><b>{({scout:'🧭',scholar:'📚',guardian:'🛡️',explorer:'🗺️'})[h.id]}</b><strong>{h.name}</strong><small>{h.ability}</small></button>)}</div>
          <div className="jumanji-players">{room.players.map(p=><div key={p.tgId}><span>🧑‍🚀 {p.name}{p.tgId===String(user?.tgId)?' (Siz)':''}</span><small>{room.heroes.find(h=>h.id===p.heroId)?.name||'Izquvar'}</small></div>)}</div>
          {isHost&&<button className="jumanji-primary" disabled={busy||room.players.length<2} onClick={()=>act('jumanji:start',{code:room.code})}>Sarguzashtni boshlash</button>}
          <button className="jumanji-quiet" onClick={async()=>{await act('jumanji:leave',{code:room.code});setRoom(null);}}>Xonadan chiqish</button>
        </>:<>
          <div className="jumanji-board"><div className="jumanji-path">{Array.from({length:30},(_,i)=><div key={i} className={room.players.some(p=>p.position===i+1)?'occupied':''}><small>{i+1}</small>{room.players.filter(p=>p.position===i+1).map(p=><span key={p.tgId} title={p.name}>{p.tgId===String(user?.tgId)?'🟢':'🔵'}</span>)}</div>)}</div></div>
          <div className="jumanji-score">{room.players.map(p=><div key={p.tgId}><b>{p.name}</b><span>{p.position}/30 · ⭐ {p.score}</span></div>)}</div>
          {room.status==='finished'?<div className="jumanji-winner">🏆 {room.players.find(p=>p.tgId===room.winnerId)?.name||'G‘olib'} marraga yetdi!</div>:room.currentEvent?<div className="jumanji-event"><small>{room.currentEvent.title} · Kubik: {room.lastRoll}</small><h3>{room.currentEvent.prompt}</h3>{room.currentEvent.type==='team'?<>
          <p>Har bir o‘yinchi bitta variantga ovoz beradi. Ko‘pchilik tanlovi qabul qilinadi.</p>
          {room.currentEvent.options?.map((opt,i)=><button key={i} className={answer===i?'selected':''} onClick={()=>setAnswer(i)} disabled={busy||room.currentEvent.votes?.some(v=>v.tgId===String(user?.tgId))}>{opt}</button>)}
          <button className="jumanji-primary" disabled={answer===null||busy||room.currentEvent.votes?.some(v=>v.tgId===String(user?.tgId))} onClick={()=>{act('jumanji:vote',{code:room.code,option:answer});setAnswer(null);}}>Ovoz berish</button>
          <small>{room.currentEvent.votes?.length||0}/{room.players.length} ovoz berildi</small>
        </>:<>
          {room.currentEvent.options?.map((opt,i)=><button key={i} className={answer===i?'selected':''} onClick={()=>setAnswer(i)} disabled={room.currentEvent.playerId!==String(user?.tgId)||busy}>{opt}</button>)}
          <button className="jumanji-primary" disabled={answer===null||room.currentEvent.playerId!==String(user?.tgId)||busy} onClick={()=>{act('jumanji:answer',{code:room.code,answer});setAnswer(null);}}>Javobni yuborish</button>
        </>}</div>:<div className="jumanji-turn"><p>Navbat: <b>{current?.name||'—'}</b></p><button className="jumanji-primary" disabled={busy||current?.tgId!==String(user?.tgId)} onClick={()=>act('jumanji:roll',{code:room.code})}>🎲 Kubik tashlash</button></div>}
        </>}
      </section>
    </>}
    {error&&<p className="jumanji-error">{error}</p>}
    <footer>ORIGINAL MULTIPLAYER ADVENTURE</footer>
  </main>;
}
