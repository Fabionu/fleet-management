import { io } from 'socket.io-client';

let socket = null;

/**
 * Conectează socket-ul cu token-ul JWT din localStorage.
 * Dacă e deja conectat, returnează instanța existentă.
 */
export function connectSocket() {
  if (socket?.connected) return socket;

  const token = localStorage.getItem('authToken');
  if (!token) return null;

  socket = io(window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('⚡ Socket conectat:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('⚡ Socket deconectat:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('⚡ Socket eroare conexiune:', err.message);
  });

  return socket;
}

/**
 * Deconectează și curăță instanța socket.
 * Emite 'user_logout' explicit înainte de disconnect, pentru a garanta
 * că serverul actualizează lista online imediat (fără a aștepta pingTimeout).
 */
export function disconnectSocket() {
  if (socket) {
    if (socket.connected) socket.emit('user_logout');
    socket.disconnect();
    socket = null;
  }
}

/**
 * Returnează instanța curentă (sau null dacă nu e conectat).
 */
export function getSocket() {
  return socket;
}
