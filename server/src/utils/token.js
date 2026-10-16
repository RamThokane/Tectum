import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const COOKIE_NAME = 'tectum_token';

/** `tv` (token version) lets us revoke every session by bumping user.tokenVersion. */
export const signToken = (user) =>
  jwt.sign({ id: String(user._id), tv: user.tokenVersion ?? 0 }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);

/** True if the token was issued for the user's current token version. */
export const isTokenCurrent = (payload, user) => (payload.tv ?? 0) === (user.tokenVersion ?? 0);

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd || env.cookieSameSite === 'none',
  sameSite: env.cookieSameSite,
  path: '/',
});

export const setAuthCookie = (res, token) =>
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });

export const clearAuthCookie = (res) => res.clearCookie(COOKIE_NAME, cookieOptions());

// ---- multiple accounts per browser ----
// A second httpOnly cookie holds the signed tokens of every account logged in on this browser,
// so members can switch between them. Tokens are verified (and version-checked) on every read.
export const ACCOUNTS_COOKIE = 'tectum_accounts';
export const MAX_SAVED_ACCOUNTS = 5;

export const readSavedTokens = (req) => {
  const v = req.cookies?.[ACCOUNTS_COOKIE];
  return Array.isArray(v) ? v.filter((t) => typeof t === 'string').slice(0, MAX_SAVED_ACCOUNTS) : [];
};

export const writeSavedTokens = (res, tokens) => {
  if (!tokens.length) return res.clearCookie(ACCOUNTS_COOKIE, cookieOptions());
  return res.cookie(ACCOUNTS_COOKIE, tokens.slice(0, MAX_SAVED_ACCOUNTS), { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
};

const tokenUserId = (t) => {
  try {
    return String(jwt.decode(t)?.id ?? '');
  } catch {
    return '';
  }
};

/** Saved tokens without the given user's entry. */
export const withoutAccount = (tokens, userId) => tokens.filter((t) => tokenUserId(t) !== String(userId));

/**
 * Issues a fresh session cookie for this user (and returns the token). When `req` is given,
 * the account is also remembered in the saved-accounts list (newest first).
 */
export const startSession = (res, user, req) => {
  const token = signToken(user);
  setAuthCookie(res, token);
  if (req) writeSavedTokens(res, [token, ...withoutAccount(readSavedTokens(req), user._id)]);
  return token;
};
