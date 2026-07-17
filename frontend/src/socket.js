import { io } from 'socket.io-client';

// Backend serveringiz 10000 portda ishlayotgani uchun shu manzilga ulanamiz
const socket = io('http://localhost:10000', {
    autoConnect: false // O'yinga kirmguncha avtomatik ulanib turmasligi uchun
});

export default socket;