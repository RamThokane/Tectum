import { Server } from 'socket.io';
import { env } from './config/env.js';
import { User } from './models/User.js';
import { COOKIE_NAME, verifyToken, isTokenCurrent } from './utils/token.js';
import { setIO } from './utils/notify.js';

const readCookie = (header = '', name) => {
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1 && part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
};

/** Real-time notifications: each authenticated socket joins a private `user:<id>` room. */
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, COOKIE_NAME);
      if (!token) return next(new Error('unauthorized'));
      const payload = verifyToken(token);
      const user = await User.findById(payload.id).select('_id tokenVersion');
      if (!user || !isTokenCurrent(payload, user)) return next(new Error('unauthorized'));
      socket.data.userId = String(user._id);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });

  setIO(io);
  return io;
}
