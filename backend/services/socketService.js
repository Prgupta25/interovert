let ioInstance = null;

export function setIO(io) {
  ioInstance = io;
}

export function getIO() {
  return ioInstance;
}

export function getUserRoom(userId) {
  return `user:${String(userId)}`;
}
