import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { env } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let memoryServer = null;

async function resolveUri() {
  if (env.mongoUri !== 'memory') return env.mongoUri;
  if (env.isProd) throw new Error('MONGO_URI=memory is for development only');

  // Keep the downloaded mongod binary in one place no matter which directory the
  // server is started from (root `npm run dev` vs. inside server/), so it downloads once.
  process.env.MONGOMS_DOWNLOAD_DIR ||= path.resolve(__dirname, '../../node_modules/.cache/mongodb-memory-server');

  // Lazy import: mongodb-memory-server is a devDependency.
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const dbPath = path.resolve(__dirname, '../../.mongo-data');
  fs.mkdirSync(dbPath, { recursive: true });
  memoryServer = await MongoMemoryServer.create({
    // launchTimeout: a busy PC can take longer than the default 10 s to start it
    instance: { dbPath, storageEngine: 'wiredTiger', port: 27018, launchTimeout: 60000 },
  });
  return memoryServer.getUri('tectum');
}

export async function connectDB() {
  const uri = await resolveUri();
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    // The dev memory server is hard-killed on shutdown (notably on Windows), so wait for
    // the journal on every write or the last ~100ms of writes can be lost.
    ...(memoryServer ? { writeConcern: { w: 1, j: true } } : {}),
  });
  console.log(`[db] MongoDB connected (${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name})`);
  // Make sure text indexes exist before the first search request.
  await mongoose.syncIndexes();
}

/**
 * For CLI scripts: with MONGO_URI=memory, reuse the dev server's database if it's already
 * running (only one process can open .mongo-data); otherwise start it as usual.
 */
export async function connectDBForScript() {
  if (env.mongoUri === 'memory') {
    try {
      await mongoose.connect('mongodb://127.0.0.1:27018/tectum', {
        serverSelectionTimeoutMS: 1500,
        writeConcern: { w: 1, j: true },
      });
      console.log('[db] Using the running dev database');
      return;
    } catch {
      await mongoose.disconnect().catch(() => {});
    }
  }
  await connectDB();
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
