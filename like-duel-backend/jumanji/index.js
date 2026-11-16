import mongoose from 'mongoose';
import crypto from 'crypto';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
const HEROES = [
  { id: 'scout', name: 'Izquvar', ability: 'Bir yurishda +1 qadam olish imkoniyati' },
  { id: 'scholar', name: 'Donishmand', ability: 'Jumboq uchun bitta qo‘shimcha urinish' },
  { id: 'guardian', name: 'Himoyachi', ability: 'Bir marta jarima qadamini bekor qilish' },
  { id: 'explorer', name: 'Sayyoh', ability: 'Mukofot katagida +1 qadam' }
];
const EVENTS = [
  { type: 'riddle', title: 'Qadimiy yozuv', prompt: 'Qaysi narsa undan qancha ko‘p olinsa, shuncha kattalashadi?', options: ['Chuqur', 'Daraxt', 'Kitob'], answer: 0, success: 2, failure: 0 },
  { type: 'quiz', title: 'O‘rmon bilimi', prompt: 'Yer yuzidagi eng katta okean qaysi?', options: ['Atlantika', 'Tinch', 'Hind'], answer: 1, success: 2, failure: 0 },
  { type: 'team', title: 'Jamoaviy tanlov', prompt: 'Yo‘l ikkiga bo‘lindi. Jamoa qaysi yo‘lni tanlaydi?', options: ['Qadimiy ko‘prik', 'Yashil so‘qmoq', 'Toshli yo‘l'], answer: null, success: 1, failure: 0 },
  { type: 'reward', title: 'Xazina sandig‘i', prompt: 'Siz xazina topdingiz! Bonus qadam olasiz.', options: [], answer: null, success: 2, failure: 0 },
  { type: 'logic', title: 'Sirli belgilar', prompt: 'Ketma-ketlikni davom ettiring: 2, 4, 8, 16, ?', options: ['18', '24', '32'], answer: 2, success: 2, failure: 0 }
];
const PlayerSchema = new mongoose.Schema({
  tgId: { type: String, required: true },
  name: { type: String, default: 'O‘yinchi' },
  heroId: { type: String, default: 'scout' },
  position: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  socketId: { type: String, default: '' }
}, { _id: false });
const RoomSchema = new mongoose.Schema({
  code: { type: String, unique: true, index: true },
  hostId: String,
  status: { type: String, enum: ['lobby', 'active', 'finished'], default: 'lobby' },
  players: { type: [PlayerSchema], default: [] },
  turnIndex: { type: Number, default: 0 },
  lastRoll: { type: Number, default: 0 },
  currentEvent: { type: mongoose.Schema.Types.Mixed, default: null },
  winnerId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
const Room = mongoose.models.JumanjiRoom || mongoose.model('JumanjiRoom', RoomSchema);
const safeRoom = room => ({
  code: room.code, status: room.status, players: room.players.map(p => ({
    tgId: p.tgId, name: p.name, heroId: p.heroId, position: p.position, score: p.score
  })),
  turnIndex: room.turnIndex, lastRoll: room.lastRoll, currentEvent: room.currentEvent,
  winnerId: room.winnerId, heroes: HEROES
});
const code = () => Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(0,32)]).join('');
const send = (ack, data) => { if (typeof ack === 'function') ack(data); };
const fail = (ack, message) => send(ack, { ok:false, error:{message} });

export function registerJumanjiHandlers(io) {
  io.on('connection', socket => {
    const tgId = String(socket.data.tgId || '');
    if (!tgId) return;
    const playerName = String(socket.data.firstName || `O‘yinchi ${tgId.slice(-4)}`).slice(0,32);
    socket.on('jumanji:create', async (payload={}, ack) => {
      try {
        if (await Room.findOne({ 'players.tgId':tgId, status:{ $in:['lobby','active'] } })) return fail(ack,'Siz allaqachon Jumanji xonasidasiz.');
        let room;
        for(let i=0;i<5;i++){ try { room=await Room.create({code:code(),hostId:tgId,players:[{tgId,name:playerName,socketId:socket.id}]}); break; } catch(e){if(e.code!==11000||i===4) throw e;} }
        await socket.join(room.code); send(ack,{ok:true,room:safeRoom(room)});
      } catch(e){ console.error('[Jumanji] create',e); fail(ack,'Xona yaratilmadi.'); }
    });
    socket.on('jumanji:join', async (payload={},ack)=>{
      try{
        const room=await Room.findOneAndUpdate({code:String(payload.code||'').toUpperCase(),status:'lobby', 'players.tgId':{$ne:tgId},$expr:{$lt:[{$size:'$players'},MAX_PLAYERS]}},{$push:{players:{tgId,name:playerName,socketId:socket.id}}},{new:true});
        if(!room){const existing=await Room.findOne({code:String(payload.code||'').toUpperCase(),'players.tgId':tgId,status:{$in:['lobby','active']}});if(existing){await socket.join(existing.code);await Room.updateOne({_id:existing._id,'players.tgId':tgId},{$set:{'players.$.socketId':socket.id}});const fresh=await Room.findById(existing._id);return send(ack,{ok:true,room:safeRoom(fresh)});}return fail(ack,'Xona topilmadi yoki to‘lgan.');}
        await socket.join(room.code);io.to(room.code).emit('jumanji:updated',safeRoom(room));send(ack,{ok:true,room:safeRoom(room)});
      }catch(e){console.error('[Jumanji] join',e);fail(ack,'Xonaga qo‘shilish amalga oshmadi.');}
    });
    socket.on('jumanji:choose_hero',async(payload={},ack)=>{
      const room=await Room.findOneAndUpdate({code:payload.code,status:'lobby','players.tgId':tgId},{$set:{'players.$.heroId':HEROES.some(h=>h.id===payload.heroId)?payload.heroId:'scout','players.$.socketId':socket.id}},{new:true});
      if(!room)return fail(ack,'Qahramonni tanlab bo‘lmadi.');
      io.to(room.code).emit('jumanji:updated',safeRoom(room));send(ack,{ok:true,room:safeRoom(room)});
    });
    socket.on('jumanji:start',async(payload={},ack)=>{
      const room=await Room.findOne({code:payload.code,status:'lobby'});
      if(!room||room.hostId!==tgId)return fail(ack,'O‘yinni faqat xona egasi boshlaydi.');
      if(room.players.length<MIN_PLAYERS)return fail(ack,'Kamida 2 o‘yinchi kerak.');
      room.status='active';room.turnIndex=0;await room.save();io.to(room.code).emit('jumanji:updated',safeRoom(room));send(ack,{ok:true,room:safeRoom(room)});
    });
    socket.on('jumanji:roll',async(payload={},ack)=>{
      try{
        const room=await Room.findOne({code:payload.code,status:'active'});
        if(!room)return fail(ack,'Faol o‘yin topilmadi.');
        const player=room.players[room.turnIndex];
        if(player?.tgId!==tgId)return fail(ack,'Hozir sizning navbatingiz emas.');
        if(room.currentEvent)return fail(ack,'Avval joriy topshiriqni yakunlang.');
        const roll=crypto.randomInt(1,7);const hero=HEROES.find(h=>h.id===player.heroId);
        const event=EVENTS[crypto.randomInt(0,EVENTS.length)];
        const steps=roll+(hero?.id==='scout'?1:0);
        player.position=Math.min(30,player.position+steps);room.lastRoll=roll;
        room.currentEvent={...event,playerId:tgId,createdAt:new Date().toISOString()};
        if(event.type==='reward'){player.score+=event.success;room.currentEvent=null;room.turnIndex=(room.turnIndex+1)%room.players.length;}
        if(player.position>=30){room.status='finished';room.winnerId=tgId;}
        await room.save();io.to(room.code).emit('jumanji:updated',safeRoom(room));send(ack,{ok:true,room:safeRoom(room)});
      }catch(e){console.error('[Jumanji] roll',e);fail(ack,'Kubik tashlashda xato.');}
    });
    socket.on('jumanji:answer',async(payload={},ack)=>{
      try{
        const room=await Room.findOne({code:payload.code,status:'active'});
        if(!room||!room.currentEvent||room.currentEvent.playerId!==tgId)return fail(ack,'Topshiriq sizga tegishli emas.');
        const event=room.currentEvent;const player=room.players[room.turnIndex];
        const correct=event.answer===null||Number(payload.answer)===event.answer;
        if(correct){player.score+=event.success||1;if(event.type==='scholar')player.score+=1;}
        else player.position=Math.max(0,player.position-1);
        room.currentEvent=null;room.turnIndex=(room.turnIndex+1)%room.players.length;
        if(player.position>=30){room.status='finished';room.winnerId=tgId;}
        await room.save();io.to(room.code).emit('jumanji:updated',safeRoom(room));send(ack,{ok:true,room:safeRoom(room),correct});
      }catch(e){console.error('[Jumanji] answer',e);fail(ack,'Javobni saqlab bo‘lmadi.');}
    });
    socket.on('jumanji:leave',async(payload={},ack)=>{
      const room=await Room.findOne({code:payload.code,'players.tgId':tgId,status:'lobby'});
      if(!room)return send(ack,{ok:true});
      room.players=room.players.filter(p=>p.tgId!==tgId);
      if(!room.players.length)await Room.deleteOne({_id:room._id});
      else{if(room.hostId===tgId)room.hostId=room.players[0].tgId;await room.save();io.to(room.code).emit('jumanji:updated',safeRoom(room));}
      socket.leave(room.code);send(ack,{ok:true});
    });
  });
}
