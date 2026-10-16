// Usage: node scripts/bench.js [srcDir=src] [rttMs=220]
// Benchmarks the API against an in-memory MongoDB behind a TCP proxy that adds network delay
// (default 220ms round trip, roughly Render Oregon <-> Atlas Mumbai), with production-like data
// (a handful of members, one case, a few comments). Prints per-endpoint median time and the
// number of DB round trips. Nothing touches the real database.
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '..', process.argv[2] || 'src');
const RTT = Number(process.argv[3] ?? 220);
process.env.MONGOMS_DOWNLOAD_DIR ||= path.resolve(__dirname, '../../node_modules/.cache/mongodb-memory-server');
process.env.AUTH_RATE_LIMIT_MAX = '100000';
process.env.SLOW_REQUEST_MS = '999999'; // keep the timing log quiet

// --- latency proxy: every chunk waits RTT/2 in each direction ---
function delayProxy(targetPort) {
  const server = net.createServer((client) => {
    const upstream = net.connect(targetPort, '127.0.0.1');
    const pipe = (from, to) => from.on('data', (chunk) => setTimeout(() => to.write(chunk), RTT / 2));
    pipe(client, upstream);
    pipe(upstream, client);
    const close = () => (client.destroy(), upstream.destroy());
    client.on('error', close).on('close', close);
    upstream.on('error', close).on('close', close);
  });
  return new Promise((r) => server.listen(0, () => r(server)));
}

const mongo = await MongoMemoryServer.create();
const proxy = await delayProxy(Number(new URL(mongo.getUri()).port));
await mongoose.connect(`mongodb://127.0.0.1:${proxy.address().port}/bench?directConnection=true`, { monitorCommands: true });
let commands = 0;
mongoose.connection.getClient().on('commandStarted', () => (commands += 1));

const { createApp } = await import(pathToFileURL(path.join(srcDir, 'app.js')).href);
await mongoose.syncIndexes();
const { User } = await import(pathToFileURL(path.join(srcDir, 'models/User.js')).href);
const { Post } = await import(pathToFileURL(path.join(srcDir, 'models/Post.js')).href);
const { Comment } = await import(pathToFileURL(path.join(srcDir, 'models/Comment.js')).href);
const { signToken } = await import(pathToFileURL(path.join(srcDir, 'utils/token.js')).href);

// --- data like production today: a few members, one case, a few comments ---
const people = await User.insertMany(
  Array.from({ length: 8 }, (_, i) => ({ name: `Member ${i}`, email: `m${i}@bench.local`, password: 'x'.repeat(60), wards: ['cardiology', 'anatomy'] }))
);
const [me, author] = people;
await User.updateOne({ _id: me._id }, { following: [author._id] });
const post = await Post.create({
  author: author._id, type: 'case_study', title: 'Chest pain', tags: ['cardiology'],
  caseStudy: { chiefComplaint: 'Chest pain for 2 hours', history: 'Smoker', diagnosis: 'Inferior STEMI', pollOptions: ['STEMI', 'PE'], correctOption: 0 },
});
await Comment.insertMany(people.slice(2, 5).map((p) => ({ post: post._id, author: p._id, text: 'Interesting case' })));

const server = createApp().listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}/api`;
const token = signToken(await User.findById(me._id));

const endpoints = [
  '/auth/me',
  `/posts/${post._id}`,
  '/posts?limit=10',
  '/posts?type=case_study&sort=discussed&limit=4',
  '/wards',
  '/notifications?limit=1',
  '/chat/unread',
  '/users/suggestions',
];

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log(`\nsrc: ${path.relative(path.resolve(__dirname, '..'), srcDir)} · simulated DB round trip ${RTT}ms\n`);
console.log('endpoint'.padEnd(50), 'median ms'.padStart(10), 'DB round trips'.padStart(15), 'bytes'.padStart(8));
for (const url of endpoints) {
  const times = [];
  let n = 0;
  let bytes = 0;
  for (let i = 0; i < 5; i++) {
    const before = commands;
    const t = performance.now();
    const res = await fetch(base + url, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.text();
    times.push(performance.now() - t);
    n = commands - before;
    bytes = body.length;
    if (!res.ok) console.log('  !', res.status, body.slice(0, 120));
  }
  console.log(url.padEnd(50), String(Math.round(median(times))).padStart(10), String(n).padStart(15), String(bytes).padStart(8));
}

server.close();
proxy.close();
await mongoose.disconnect();
await mongo.stop();
process.exit(0);
