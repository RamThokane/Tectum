// Demo accounts + NEET-PG content for Tectum (see README.md in this folder).
//
//   node scripts/seed-demo --check        check the content files only (no database)
//   node scripts/seed-demo                create / update the demo data (local database only)
//   node scripts/seed-demo --csv          write demo-review.csv (cases + posts) for medical review
//   node scripts/seed-demo --cleanup      delete every demo account and everything they made
//   add --production to any of these to allow a non-local database (the live site!)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../../src/config/env.js';
import { connectDBForScript, disconnectDB } from '../../src/config/db.js';
import { User } from '../../src/models/User.js';
import { Post } from '../../src/models/Post.js';
import { Comment } from '../../src/models/Comment.js';
import { Notification } from '../../src/models/Notification.js';
import { Activity } from '../../src/models/Activity.js';
import { ContentView } from '../../src/models/ContentView.js';
import { findPrivacyIssues } from '../../src/utils/privacy.js';
import { topContributorsByWard, RANKING, hideDemoInRankings } from '../../src/utils/rankings.js';
import { TERMS_VERSION } from '../../src/validators.js';
import { CONFIG } from './config.js';
import { rng } from './rng.js';
import { makePeople } from './people.js';
import { mapSubjectsToWards, YEAR_NAMES } from './subjects.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const NOW = new Date();
const DAY = 86400000;
const IST_OFFSET = 5.5 * 3600000;

// ------------------------------------------------------------------ content

async function loadContent(seededSlugs) {
  const dir = path.join(__dirname, 'content');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  const wards = [];
  for (const f of files) {
    const mod = (await import(pathToFileURL(path.join(dir, f)).href)).default;
    if (!seededSlugs.has(mod.ward)) throw new Error(`${f}: Ward "${mod.ward}" is not one of the seeded subjects`);
    wards.push({ file: f, ...mod });
  }
  return wards;
}

const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
const similarity = (a, b) => {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared += 1;
  return shared / Math.min(A.size, B.size);
};

/** Checks every item; returns a list of problems (empty = all good). */
function checkContent(wards, subjectsBySlug) {
  const problems = [];
  const keys = new Set();
  const combos = new Map();
  const all = [];
  for (const w of wards) {
    const s = subjectsBySlug.get(w.ward);
    const band = s.priority ? 'priority' : 'other';
    const [pMin, pMax] = CONFIG.POSTS_PER_WARD[band];
    const [cMin, cMax] = CONFIG.CASES_PER_WARD[band];
    if (w.posts.length < pMin || w.posts.length > pMax) problems.push(`${w.ward}: ${w.posts.length} posts (want ${pMin}-${pMax})`);
    if (w.cases.length < cMin || w.cases.length > cMax) problems.push(`${w.ward}: ${w.cases.length} cases (want ${cMin}-${cMax})`);
    const combo = `${w.posts.length}/${w.cases.length}`;
    if (combos.has(combo)) problems.push(`${w.ward}: same post/case numbers (${combo}) as ${combos.get(combo)}`);
    combos.set(combo, w.ward);

    for (const p of w.posts) {
      if (keys.has(p.key)) problems.push(`duplicate key ${p.key}`);
      keys.add(p.key);
      if (!p.title || !p.points?.length) problems.push(`${p.key}: needs a title and points`);
      if (p.title?.length > 200) problems.push(`${p.key}: title over 200 characters`);
      all.push({ key: p.key, text: `${p.title} ${p.points.join(' ')}`, privacy: [p.title, ...p.points].join('\n') });
    }
    for (const c of w.cases) {
      if (keys.has(c.key)) problems.push(`duplicate key ${c.key}`);
      keys.add(c.key);
      for (const f of ['title', 'cc', 'history', 'question', 'answer', 'explanation']) if (!c[f]) problems.push(`${c.key}: missing ${f}`);
      if (c.options?.length !== 4) problems.push(`${c.key}: needs exactly 4 options`);
      if (!(c.correct >= 0 && c.correct <= 3)) problems.push(`${c.key}: correct must be 0-3`);
      if (new Set(c.options ?? []).size !== (c.options ?? []).length) problems.push(`${c.key}: repeated option`);
      for (const o of c.options ?? []) if (o.length > 120) problems.push(`${c.key}: option over 120 characters: "${o}"`);
      if (c.cc?.length > 1000) problems.push(`${c.key}: chief complaint too long`);
      if (c.answer?.length > 2000 || c.explanation?.length > 2000) problems.push(`${c.key}: answer/explanation too long`);
      if (c.answer && c.options && !c.answer.toLowerCase().includes(c.options[c.correct]?.toLowerCase().slice(0, 12))) {
        problems.push(`${c.key}: "answer" should start with the correct option ("${c.options[c.correct]}")`);
      }
      all.push({
        key: c.key,
        text: `${c.cc} ${c.history} ${c.exam ?? ''} ${c.question}`,
        privacy: [c.title, c.cc, c.history, c.exam, c.inv, c.question, c.answer, c.explanation].filter(Boolean).join('\n'),
      });
    }
  }
  for (const item of all) {
    const issues = findPrivacyIssues(item.privacy);
    if (issues.length) problems.push(`${item.key}: the privacy check would flag it (${issues.map((i) => `${i.label}: "${i.text}"`).join('; ')})`);
  }
  // Near-duplicates anywhere in the demo content.
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      if (similarity(all[i].text, all[j].text) > 0.75) problems.push(`${all[i].key} and ${all[j].key} look like the same question`);
    }
  }
  return problems;
}

// ------------------------------------------------------------------ plan (who writes what, when, who likes it)

function planHomeWards(people, subjects) {
  const byYear = { first: [], second: [], final: [] };
  for (const s of subjects) byYear[s.year].push(s);
  const homes = new Map();
  for (const p of people) {
    const r = rng(`${CONFIG.SEED}:home:${p.n}`);
    const n = p.tier === 'power' ? CONFIG.HOME_WARDS_PER_ACCOUNT[1] : r.int(...CONFIG.HOME_WARDS_PER_ACCOUNT);
    const pool =
      p.year === 'intern'
        ? subjects.map((s) => ({ s, w: s.year === 'final' ? (s.priority ? 3 : 1.5) : 1 }))
        : byYear[p.year].map((s) => ({ s, w: s.priority ? 2 : 1 }));
    homes.set(p.n, r.weightedSample(pool, Math.min(n, pool.length), (x) => x.w).map((x) => x.s.slug));
  }
  // Every seeded Ward needs enough possible authors so content comes from many people.
  for (const s of subjects) {
    const want = s.priority ? 10 : 6;
    const have = people.filter((p) => homes.get(p.n).includes(s.slug));
    if (have.length >= want) continue;
    const r = rng(`${CONFIG.SEED}:topup:${s.slug}`);
    const extra = r.shuffle(people.filter((p) => !homes.get(p.n).includes(s.slug) && (p.year === s.year || p.year === 'intern')));
    for (const p of extra.slice(0, want - have.length)) homes.get(p.n).push(s.slug);
  }
  return homes;
}

/** Spread across the last CONTENT_DAYS_AGO days (leaning recent), at the author's usual hours (IST). */
function planTime(key, person) {
  const r = rng(`${CONFIG.SEED}:time:${key}`);
  const [d0, d1] = CONFIG.CONTENT_DAYS_AGO;
  const daysAgo = d0 + (d1 - d0) * r.next() ** CONFIG.RECENT_BIAS;
  const [h0, h1] = CONFIG.TIME_PATTERNS[person.timePattern];
  const hour = r.range(h0, h1);
  const istDay = new Date(NOW.getTime() + IST_OFFSET - daysAgo * DAY);
  istDay.setUTCHours(0, 0, 0, 0);
  let at = new Date(istDay.getTime() - IST_OFFSET + hour * 3600000);
  while (at > new Date(NOW.getTime() - 20 * 60000)) at = new Date(at.getTime() - DAY);
  if (at < person.joinedAt) at = new Date(person.joinedAt.getTime() + r.range(1, 10) * DAY);
  return at;
}

function plan(people, wards, subjectsBySlug) {
  const homes = planHomeWards(people, [...subjectsBySlug.values()]);
  const items = [];
  for (const w of wards) {
    const subject = subjectsBySlug.get(w.ward);
    const authors = people.filter((p) => homes.get(p.n).includes(w.ward));
    const inWard = new Map(); // author n -> items already given to them in this Ward
    const cap = Math.ceil(CONFIG.MAX_SHARE_PER_WARD * (w.posts.length + w.cases.length));
    for (const [type, list] of [['post', w.posts], ['case', w.cases]]) {
      for (const item of list) {
        const r = rng(`${CONFIG.SEED}:author:${item.key}`);
        // Interns write more of the final-year cases; repeat authors in a Ward get less likely.
        const author = r.weighted(authors, (p) => {
          const had = inWard.get(p.n) ?? 0;
          if (had >= cap) return 0;
          return p.weight * CONFIG.SAME_WARD_DECAY ** had * (type === 'case' && subject.year === 'final' && p.year === 'intern' ? 1.6 : 1);
        });
        inWard.set(author.n, (inWard.get(author.n) ?? 0) + 1);
        items.push({ type, item, ward: w.ward, subject, author });
      }
    }
    // At least MIN_AUTHORS_PER_WARD different people: hand items from the busiest author to unused candidates.
    const wardItems = items.filter((x) => x.ward === w.ward);
    const unused = authors.filter((p) => !inWard.has(p.n)).sort((a, b) => b.weight - a.weight || a.n - b.n);
    while (inWard.size < CONFIG.MIN_AUTHORS_PER_WARD && unused.length) {
      const [busiestN] = [...inWard.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
      if (inWard.get(busiestN) < 2) break;
      const give = wardItems.filter((x) => x.author.n === busiestN).sort((a, b) => b.item.key.localeCompare(a.item.key))[0];
      const to = unused.shift();
      give.author = to;
      inWard.set(busiestN, inWard.get(busiestN) - 1);
      inWard.set(to.n, 1);
    }
  }
  // Everyone writes at least one thing: give quiet accounts an item from the busiest NON-power
  // author in one of their Wards (power accounts keep their lead for the rankings).
  const count = (p) => items.filter((x) => x.author === p).length;
  for (const p of people) {
    if (count(p) > 0) continue;
    const mine = items.filter((x) => homes.get(p.n).includes(x.ward) && x.author.tier !== 'power' && count(x.author) > 1);
    if (!mine.length) continue;
    const take = mine.sort((a, b) => count(b.author) - count(a.author) || a.item.key.localeCompare(b.item.key))[0];
    take.author = p;
  }
  for (const x of items) x.createdAt = planTime(x.item.key, x.author);
  // Every Ward needs at least TOP_N different authors inside the ranking window, or its Top
  // Contributors list would be short: move one older item of other authors into the window.
  const windowStart = NOW.getTime() - (RANKING.WINDOW_DAYS - 1) * DAY;
  for (const w of wards) {
    const inWard = items.filter((x) => x.ward === w.ward).sort((a, b) => a.item.key.localeCompare(b.item.key));
    const recentAuthors = new Set(inWard.filter((x) => x.createdAt >= windowStart).map((x) => x.author.n));
    for (const x of inWard) {
      if (recentAuthors.size >= RANKING.TOP_N) break;
      if (recentAuthors.has(x.author.n)) continue;
      const r = rng(`${CONFIG.SEED}:recent:${x.item.key}`);
      x.createdAt = new Date(x.createdAt.getTime() + Math.ceil((windowStart - x.createdAt.getTime()) / DAY + r.int(1, RANKING.WINDOW_DAYS - 3)) * DAY);
      recentAuthors.add(x.author.n);
    }
  }
  for (const x of items) {
    // Likes from other demo accounts, mostly the same year / Ward; some accounts like a lot.
    const r = rng(`${CONFIG.SEED}:likes:${x.item.key}`);
    const n = r.int(...CONFIG.LIKES_PER_ITEM);
    const related = (p) => p.year === x.author.year || homes.get(p.n).includes(x.ward) || (p.year === 'intern' && x.subject.year === 'final');
    const boost = CONFIG.SAME_YEAR_LIKER_SHARE / (1 - CONFIG.SAME_YEAR_LIKER_SHARE);
    x.likers = r.weightedSample(people.filter((p) => p !== x.author), n, (p) => p.likerWeight * (related(p) ? boost * 2 : 1));
  }
  return { items, homes };
}

// ------------------------------------------------------------------ rendering (each author keeps one writing style)

const INFORMAL = [
  [/\bpatients\b/g, 'pts'],
  [/\bpatient\b/g, 'pt'],
  [/\bdiagnosis\b/g, 'dx'],
  [/\bimportant\b/g, 'imp'],
  [/\btreatment\b/g, 'Rx'],
  [/\bprevious year question(s?)\b/gi, 'PYQ$1'],
];
const informal = (s) => INFORMAL.reduce((t, [re, to]) => t.replace(re, to), s);

function renderPost(post, author) {
  const pts = post.points.map((p) => (author.informal ? informal(p) : p));
  const marker = { bullets: () => '• ', dashes: () => '- ', arrows: () => '→ ', numbered: (i) => `${i + 1}. `, compact: () => '' }[author.style];
  const body = pts.map((p, i) => marker(i) + p).join('\n');
  return [post.intro, body, post.outro].filter(Boolean).join('\n\n');
}

function renderCaseQuestion(c, author) {
  return author.informal ? informal(c.question) : c.question;
}

function postDoc(x, userId) {
  const { item, type, ward } = x;
  const base = {
    author: userId,
    tags: [ward],
    createdAt: x.createdAt,
    updatedAt: x.createdAt,
    rankAt: x.createdAt,
    seedKey: item.key,
    likes: [],
  };
  if (type === 'post') return { ...base, type: 'text', kind: item.kind ?? 'pearl', title: item.title, content: renderPost(item, x.author) };
  return {
    ...base,
    type: 'case_study',
    kind: 'discussion',
    title: item.title,
    content: renderCaseQuestion(item, x.author),
    caseStudy: {
      age: item.age,
      sex: item.sex,
      chiefComplaint: item.cc,
      history: item.history,
      examinationFindings: item.exam ?? '',
      investigations: item.inv ?? '',
      diagnosis: item.answer,
      learningPoint: item.explanation,
      mcqTips: (item.tips ?? []).join('\n'),
      references: item.ref ?? '',
      difficulty: 'hard',
      pollOptions: item.options,
      correctOption: item.correct,
    },
  };
}

// ------------------------------------------------------------------ database

function assertSafeDatabase() {
  const uri = env.mongoUri;
  const local = uri === 'memory' || /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(uri);
  if (!local && !args.has('--production')) {
    console.error('\nSTOPPED: server/.env points at a non-local database (probably the LIVE site).');
    console.error('Test first with a local database:   $env:MONGO_URI="memory"; node scripts/seed-demo');
    console.error('Only after the CSV review, to really write to that database, add --production.\n');
    process.exit(1);
  }
  if (!local) console.warn('[seed-demo] --production: writing to a NON-LOCAL database.');
}

async function upsertPeople(people, homes) {
  const ids = new Map();
  const unusable = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10); // nobody knows it: demo accounts can't log in
  for (const p of people) {
    const fields = {
      name: p.name,
      role: 'student',
      studyYear: p.studyYear,
      yearLabel: p.yearLabel,
      course: 'mbbs',
      country: 'IN',
      institution: p.college.name,
      bio: p.bio,
      wards: homes.get(p.n),
      profilePicture: '', // initials avatar
      isDemo: true,
    };
    const existing = await User.findOne({ email: p.email }).select('+isDemo username');
    if (existing && !existing.isDemo) throw new Error(`${p.email} belongs to a real account - not touching it`);
    // A real member may already own the handle: add digits until it's free.
    let username = existing?.username ?? p.username;
    while (await User.exists({ username, email: { $ne: p.email } })) username = `${p.username}${crypto.randomInt(2, 99)}`;
    if (existing) {
      await User.updateOne({ _id: existing._id }, { $set: { ...fields, username } });
      ids.set(p.n, existing._id);
    } else {
      const doc = new User({
        ...fields,
        username,
        email: p.email,
        password: unusable,
        emailVerified: true,
        onboardedAt: p.joinedAt,
        acceptedTermsAt: p.joinedAt,
        termsVersion: TERMS_VERSION,
      }).toObject();
      doc.createdAt = p.joinedAt;
      doc.updatedAt = p.joinedAt;
      await User.collection.insertOne(doc);
      ids.set(p.n, doc._id);
    }
  }
  return ids;
}

async function writeItems(items, userIds) {
  const found = await Post.find({ seedKey: { $in: items.map((x) => x.item.key) } }).select('+seedKey likes').lean();
  const existing = new Set(found.map((p) => p.seedKey));
  // Likes from real members on demo posts are kept; demo likes are reset to the plan.
  const demoIds = new Set([...userIds.values()].map(String));
  const realLikes = new Map(found.map((p) => [p.seedKey, (p.likes ?? []).filter((id) => !demoIds.has(String(id)))]));
  let created = 0;
  let updated = 0;
  for (let i = 0; i < items.length; i += CONFIG.BATCH_SIZE) {
    const batch = items.slice(i, i + CONFIG.BATCH_SIZE);
    const inserts = [];
    const ops = [];
    for (const x of batch) {
      const doc = postDoc(x, userIds.get(x.author.n));
      const likes = x.likers.map((p) => userIds.get(p.n));
      if (existing.has(x.item.key)) {
        // Re-run: refresh the text (fixes from the medical review apply), author and demo likes.
        const { createdAt: _c, updatedAt: _u, rankAt: _r, likes: _l, ...fields } = doc;
        const keep = realLikes.get(x.item.key) ?? [];
        ops.push({ updateOne: { filter: { seedKey: x.item.key }, update: { $set: { ...fields, likes: [...keep, ...likes] } } } });
        updated += 1;
      } else {
        const post = new Post({ ...doc, likes });
        await post.validate().catch((err) => {
          throw new Error(`${x.item.key}: ${err.message}`);
        });
        const o = post.toObject();
        o.createdAt = doc.createdAt;
        o.updatedAt = doc.updatedAt;
        inserts.push(o);
        created += 1;
      }
    }
    if (inserts.length) await Post.collection.insertMany(inserts, { ordered: false });
    if (ops.length) await Post.bulkWrite(ops);
    process.stdout.write(`\r[seed-demo] items ${Math.min(i + CONFIG.BATCH_SIZE, items.length)}/${items.length}`);
  }
  process.stdout.write('\n');
  return { created, updated };
}

async function cleanup() {
  const ids = await User.find({ isDemo: true }).distinct('_id');
  if (!ids.length) return console.log('[seed-demo] no demo accounts found - nothing to delete.');
  const posts = await Post.find({ author: { $in: ids } }).distinct('_id');
  const pull = { likes: { $in: ids }, reposts: { $in: ids }, bookmarks: { $in: ids }, solvedBy: { $in: ids }, pollVotes: { user: { $in: ids } }, downloaders: { $in: ids } };
  const results = await Promise.all([
    Post.deleteMany({ _id: { $in: posts } }),
    Post.updateMany({}, { $pull: pull }),
    Comment.deleteMany({ $or: [{ author: { $in: ids } }, { post: { $in: posts } }] }),
    Comment.updateMany({}, { $pull: { likes: { $in: ids }, reposts: { $in: ids }, bookmarks: { $in: ids } } }),
    Notification.deleteMany({ $or: [{ sourceUser: { $in: ids } }, { recipient: { $in: ids } }, { post: { $in: posts } }] }),
    Activity.deleteMany({ user: { $in: ids } }),
    ContentView.deleteMany({ $or: [{ viewer: { $in: ids } }, { target: { $in: posts } }] }),
    User.updateMany({}, { $pull: { followers: { $in: ids }, following: { $in: ids }, muted: { $in: ids }, blocked: { $in: ids } } }),
  ]);
  await User.deleteMany({ _id: { $in: ids } });
  console.log(`[seed-demo] deleted ${ids.length} demo accounts, ${results[0].deletedCount} posts/cases and ${results[2].deletedCount} comments; removed their likes and follows from everyone else's content.`);
  console.log('[seed-demo] Top Contributor badges are worked out live, so they are gone too (within 10 minutes on a running server).');
}

// ------------------------------------------------------------------ CSV + summary

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function writeCsv(items) {
  const header = ['ward', 'year', 'type', 'author', 'handle', 'college', 'title', 'question / text', 'option A', 'option B', 'option C', 'option D', 'correct answer', 'explanation', 'exam tips', 'reference', 'key'];
  const rows = items.map((x) => {
    const base = [x.subject.label ?? x.ward, YEAR_NAMES[x.subject.year], x.type === 'case' ? 'case + poll' : 'post', x.author.name, `@${x.author.username}`, x.author.college.name, x.item.title];
    if (x.type === 'post') return [...base, renderPost(x.item, x.author), '', '', '', '', '', '', '', x.item.ref ?? '', x.item.key];
    const c = x.item;
    const vignette = [
      `${c.age ?? ''} ${c.sex ?? ''}`.trim(),
      `CC: ${c.cc}`,
      `History: ${c.history}`,
      c.exam && `Exam: ${c.exam}`,
      c.inv && `Investigations: ${c.inv}`,
      `Q: ${c.question}`,
    ].filter(Boolean).join('\n');
    return [...base, vignette, ...c.options, `${'ABCD'[c.correct]}. ${c.options[c.correct]}\n${c.answer}`, c.explanation, (c.tips ?? []).join('\n'), c.ref ?? '', c.key];
  });
  const file = path.resolve(__dirname, '../..', CONFIG.CSV_PATH);
  // BOM so Excel opens it as UTF-8.
  fs.writeFileSync(file, '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n'), 'utf8');
  return file;
}

function printPlanSummary(people, items, found, missing) {
  const by = (list, f) => list.reduce((m, x) => m.set(f(x), (m.get(f(x)) ?? 0) + 1), new Map());
  const fmt = (m) => [...m.entries()].map(([k, v]) => `${k}: ${v}`).join(', ');
  console.log('\n================ DEMO SEED SUMMARY ================');
  console.log(`Accounts: ${people.length} (${fmt(by(people, (p) => p.gender))})`);
  console.log(`  by year: ${fmt(by(people, (p) => YEAR_NAMES[p.year]))}`);
  const top = people.filter((p) => p.college.tier === 'top');
  console.log(`  top-level colleges: ${top.length} accounts (${top.map((p) => p.college.short).join(', ')})`);
  console.log(`  mid-level colleges: ${people.length - top.length} accounts across ${new Set(people.filter((p) => p.college.tier === 'mid').map((p) => p.college.name)).size} colleges`);
  const perCollege = [...by(people, (p) => p.college.short).entries()].sort((a, b) => b[1] - a[1]);
  console.log(`  per college: ${perCollege.map(([k, v]) => `${k} ${v}`).join(', ')}`);
  const perAuthor = by(items, (x) => x.author.n);
  const counts = people.map((p) => perAuthor.get(p.n) ?? 0).sort((a, b) => b - a);
  console.log(`  items per account: max ${counts[0]}, ${counts.filter((c) => c >= 30).length} with 30+, ${counts.filter((c) => c >= 5 && c < 30).length} with 5-29, ${counts.filter((c) => c >= 1 && c < 5).length} with 1-4, ${counts.filter((c) => !c).length} with none`);
  const busiest = [...people].sort((a, b) => (perAuthor.get(b.n) ?? 0) - (perAuthor.get(a.n) ?? 0)).slice(0, 8);
  console.log(`  most active: ${busiest.map((p) => `${p.name} (${YEAR_NAMES[p.year]}, ${p.college.short}) ${perAuthor.get(p.n) ?? 0}`).join('; ')}`);
  console.log(`\nWards found (${found.length}): ${found.map((s) => `${s.subject} -> ${s.slug}`).join(', ')}`);
  console.log(`Wards MISSING (not created): ${missing.length ? missing.join(', ') : 'none'}`);
  console.log('\nPer Ward (posts / cases with polls):');
  for (const s of found) {
    const inWard = items.filter((x) => x.ward === s.slug);
    if (!inWard.length) {
      console.log(`  ${s.label.padEnd(26)} (no content file yet)`);
      continue;
    }
    console.log(`  ${s.label.padEnd(26)} ${String(inWard.filter((x) => x.type === 'post').length).padStart(2)} posts / ${String(inWard.filter((x) => x.type === 'case').length).padStart(2)} cases   ${new Set(inWard.map((x) => x.author.n)).size} authors`);
  }
  const likes = items.reduce((s, x) => s + x.likers.length, 0);
  console.log(`\nTotal: ${items.length} items, ${likes} likes`);
}

async function printTopContributors(found, userIds, people) {
  const byId = new Map(people.map((p) => [String(userIds.get(p.n)), p]));
  const top = await topContributorsByWard();
  console.log(`\nTop 5 contributors per Ward (last ${RANKING.WINDOW_DAYS} days, score = items x ${RANKING.ITEM_WEIGHT} + likes${(await hideDemoInRankings()) ? ', demo HIDDEN' : ''}):`);
  for (const s of found) {
    const list = top.get(s.slug) ?? [];
    if (!list.length) continue;
    console.log(`  ${s.label}`);
    for (const [i, t] of list.entries()) {
      const p = byId.get(String(t.user));
      const who = p ? `${p.name} (@${p.username}), ${p.college.short}` : `real member ${t.user}`;
      console.log(`    ${i + 1}. ${who} - score ${t.score} (${t.cases} cases, ${t.posts} posts, ${t.likes} likes)`);
    }
  }
}

// ------------------------------------------------------------------ main

async function main() {
  const { found, missing } = mapSubjectsToWards();
  const subjectsBySlug = new Map(found.map((s) => [s.slug, s]));
  const wards = await loadContent(new Set(subjectsBySlug.keys()));
  const problems = checkContent(wards, subjectsBySlug);
  if (problems.length) {
    console.error(`[seed-demo] ${problems.length} problem(s) in the content files:`);
    problems.forEach((p) => console.error(`  - ${p}`));
    if (!args.has('--cleanup')) process.exit(1);
  }
  const people = makePeople(NOW);
  const { items, homes } = plan(people, wards, subjectsBySlug);

  if (args.has('--check')) {
    printPlanSummary(people, items, found, missing);
    console.log('\n[seed-demo] content check passed (nothing written).');
    return;
  }
  if (args.has('--csv') && !args.has('--write')) {
    console.log(`[seed-demo] review file: ${writeCsv(items)}`);
    return;
  }

  assertSafeDatabase();
  await connectDBForScript();
  console.log(`[seed-demo] database: ${mongoose.connection.host}/${mongoose.connection.name}`);
  if (args.has('--cleanup')) {
    await cleanup();
    return;
  }
  const userIds = await upsertPeople(people, homes);
  console.log(`[seed-demo] ${userIds.size} demo accounts ready`);
  const { created, updated } = await writeItems(items, userIds);
  console.log(`[seed-demo] ${created} items created, ${updated} already there (refreshed)`);
  printPlanSummary(people, items, found, missing);
  await printTopContributors(found, userIds, people);
  console.log(`\nCSV review file: ${writeCsv(items)}`);
}

main()
  .catch((err) => {
    console.error('[seed-demo] failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => (mongoose.connection.readyState ? disconnectDB() : undefined));
