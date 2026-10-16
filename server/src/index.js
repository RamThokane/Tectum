import http from 'node:http';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';
import { initSocket } from './socket.js';
import { Post } from './models/Post.js';
import { User } from './models/User.js';
import { backfillUsernames } from './utils/username.js';
import { startPrivacySweep } from './utils/privacySweep.js';
import { startQuizSweep } from './utils/quizAttempts.js';

async function main() {
  await connectDB();
  // One-off backfill for posts created before feed ranking existed.
  await Post.updateMany({ rankAt: { $exists: false } }, [{ $set: { rankAt: '$createdAt' } }], { updatePipeline: true });
  await backfillUsernames(User);
  console.log(`[ai-moderation] image review: ${env.anthropicApiKey ? 'ON (Claude)' : 'OFF - set ANTHROPIC_API_KEY to enable'}`);

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.port, () => {
    console.log(`[server] Tectum API listening on http://localhost:${env.port}`);
  });
  // Patient privacy: flag / remove published posts and comments that identify a patient.
  startPrivacySweep();
  // Tests: auto-submit attempts whose time ran out (closed pages, lost connections).
  startQuizSweep();

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received, shutting down`);
    server.close();
    await disconnectDB().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] failed to start:', err.message);
  if (/ECONNREFUSED|ServerSelection/i.test(err.message)) {
    console.error(
      '[server] Could not reach MongoDB. Start a local mongod, use an Atlas URI, or set MONGO_URI=memory in server/.env for a zero-install dev database.'
    );
  }
  process.exit(1);
});
