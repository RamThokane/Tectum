import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const json = (message) => ({ message });

/** Strict limiter for signup/login to slow down credential stuffing. */
export const authLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMin * 60 * 1000,
  limit: env.authRateLimitMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many attempts, please try again later'),
});

/** Broad safety net for the rest of the API. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many requests, slow down'),
});
