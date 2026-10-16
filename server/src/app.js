import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
// Before any route (and so any model) is imported: its Mongoose plugin must exist when models compile.
import { dbTiming } from './utils/dbTiming.js';
import { notFound, errorHandler } from './middleware/error.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { PUBLIC_DIR } from './utils/storage.js';
import { isKnownPage, robotsTxt, sitemapXml, canonicalFor, withCanonical } from './utils/seo.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import notificationRoutes from './routes/notifications.js';
import searchRoutes from './routes/search.js';
import adminRoutes from './routes/admin.js';
import supportRoutes from './routes/support.js';
import topicRoutes from './routes/topics.js';
import adRoutes from './routes/ads.js';
import chatRoutes from './routes/chat.js';
import wardRoutes from './routes/wards.js';
import reviewRoutes from './routes/reviews.js';
import quizRoutes from './routes/quizzes.js';
import attemptRoutes from './routes/attempts.js';
import publicRoutes from './routes/public.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  if (env.isProd) app.set('trust proxy', 1);

  app.use(
    helmet({
      // Uploaded images/notes are loaded by the SPA, which may live on another origin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // "Continue with Google": its sign-in popup must be able to report back to this page
      // (helmet's default `same-origin` cut it off), and Google's button checks which site it's on
      // from the referrer, which helmet's default `no-referrer` hid. Both are Google's recommendations.
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      contentSecurityPolicy: env.isProd
        ? {
            directives: {
              scriptSrc: ["'self'", 'https://accounts.google.com', 'https://apis.google.com'],
              frameSrc: ["'self'", 'https://accounts.google.com'],
              connectSrc: ["'self'", 'wss:', 'https://accounts.google.com'],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              // accounts.google.com/gsi/style: the "Continue with Google" button's stylesheet
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            },
          }
        : false,
    })
  );
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use(dbTiming); // per-request DB timing: Server-Timing header + slow-request log
  if (!env.isProd) app.use(morgan('dev'));

  // Public uploads (local-disk fallback only; Cloudinary URLs are absolute).
  app.use('/uploads', express.static(PUBLIC_DIR, { maxAge: '7d', index: false }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  // Public settings the web app needs before anyone logs in (no secrets here).
  app.get('/api/config', (_req, res) => res.json({ googleClientId: env.googleClientId }));

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/topics', topicRoutes);
  app.use('/api/ads', adRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/wards', wardRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/quizzes', quizRoutes);
  app.use('/api/attempts', attemptRoutes);
  app.use('/api/public', publicRoutes);

  // Crawler files: real text/plain and XML (they used to fall through to the app's HTML).
  const siteOrigin = env.clientUrl.replace(/\/$/, '');
  app.get('/robots.txt', (_req, res) => res.type('text/plain').set('Cache-Control', 'public, max-age=86400').send(robotsTxt(siteOrigin)));
  app.get('/sitemap.xml', (_req, res) => res.type('application/xml').set('Cache-Control', 'public, max-age=86400').send(sitemapXml(siteOrigin)));

  // In production, serve the built React app from the same origin.
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (env.isProd && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false }));
    const indexHtml = fs.readFileSync(path.join(clientDist, 'index.html'), 'utf8');
    app.get(/^\/(?!api|uploads|socket\.io).*/, (req, res) => {
      // Unknown addresses still get the app (it shows "Page not found"), but with HTTP 404 so
      // search engines don't index them as real pages ("soft 404s").
      res
        .status(isKnownPage(req.path) ? 200 : 404)
        .type('html')
        .set('Cache-Control', 'no-cache')
        .send(withCanonical(indexHtml, canonicalFor(siteOrigin, req.path)));
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
