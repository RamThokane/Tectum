import { User } from '../models/User.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { COOKIE_NAME, verifyToken, isTokenCurrent } from '../utils/token.js';

const ACTIVE_EVERY_MS = 5 * 60 * 1000;

export const extractToken = (req) => {
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
};

/** Verifies the JWT (httpOnly cookie, or Bearer header) and attaches req.user. */
export const protect = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Session expired, please log in again');
  }

  // +notInterested: feeds need it, and loading it here saves them a second round trip.
  const user = await User.findById(payload.id).select('+lastActiveAt +notInterested +isDemo');
  if (!user || !isTokenCurrent(payload, user)) throw ApiError.unauthorized('Session expired, please log in again');
  if (!user.lastActiveAt || Date.now() - user.lastActiveAt > ACTIVE_EVERY_MS) {
    User.updateOne({ _id: user._id }, { lastActiveAt: new Date() }).catch(() => {});
  }
  req.user = user;
  next();
});

export const requireAdmin = (req, _res, next) =>
  req.user?.isAdmin ? next() : next(ApiError.forbidden('Admin access required'));
