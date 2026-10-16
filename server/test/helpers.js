// Shared test setup: an in-memory MongoDB, the real Express app on a random port, and
// signed-in fetch helpers. Never touches the database in server/.env.
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.MONGOMS_DOWNLOAD_DIR ||= path.resolve(__dirname, '../../node_modules/.cache/mongodb-memory-server');
process.env.AUTH_RATE_LIMIT_MAX = '10000';

let mongo;
let server;
let base;

export async function start() {
  // A slow or busy PC can take longer than the default 10 s to start the test database.
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongo.getUri('tectum-test'));
  const { createApp } = await import('../src/app.js'); // registers every model first
  await mongoose.syncIndexes();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
}

/** The test server's API address, e.g. http://127.0.0.1:53211/api */
export const apiBase = () => base;

export async function stop() {
  server?.close();
  await mongoose.disconnect();
  await mongo?.stop();
}

let n = 0;
/** Creates a member and returns { user, api } where api(method, path, body) is signed in as them. */
export async function member(extra = {}) {
  const { User } = await import('../src/models/User.js');
  const { signToken } = await import('../src/utils/token.js');
  n += 1;
  const user = await User.create({ name: `Test Member ${n}`, email: `t${n}-${Date.now()}@test.local`, password: 'x'.repeat(60), ...extra });
  const token = signToken(user);
  const api = async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };
  return { user, api };
}

/** A case with a hidden answer, written directly to the database. */
export async function makeCase(author, overrides = {}) {
  const { Post } = await import('../src/models/Post.js');
  return Post.create({
    author: author._id,
    type: 'case_study',
    title: 'Progressive dysphagia',
    content: 'What is going on?',
    caseStudy: {
      chiefComplaint: 'Difficulty swallowing solids and liquids for 6 months',
      history: 'Regurgitation of undigested food',
      examinationFindings: 'Unremarkable',
      investigations: 'Barium swallow: bird-beak appearance',
      diagnosis: 'Achalasia cardia',
      learningPoint: 'Manometry confirms the diagnosis',
      mcqTips: 'Heller myotomy',
      pollOptions: ['Achalasia cardia', 'Oesophageal cancer'],
      correctOption: 0,
    },
    ...overrides,
  });
}
