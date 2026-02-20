import { io } from 'socket.io-client';
import { API_URL } from '../config/config';
import { getAuthToken } from './session';

let socketInstance = null;

export function getSocket() {
  const token = getAuthToken();
  if (!token) return null;

  if (!socketInstance) {
    socketInstance = io(API_URL, {
      transports: ['websocket'],
      auth: { token },
    });
  }

  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
