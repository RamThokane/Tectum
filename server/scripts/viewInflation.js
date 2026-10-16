// Usage: npm run view-report
// READ-ONLY. Reports how inflated view counts are from the old "count every load" behaviour.
// Under the new rule each member adds at most one view per post (or comment) per day, so the
// most a post could honestly have is (members other than its author) x (days it has existed).
// Nothing is changed; resetting numbers is a separate decision.
import { connectDBForScript, disconnectDB } from '../src/config/db.js';
import { Post } from '../src/models/Post.js';
import { Comment } from '../src/models/Comment.js';
import { User } from '../src/models/User.js';

const DAY = 86400000;

await connectDBForScript();
const now = Date.now();
const members = await User.find().select('createdAt').lean();
// Everyone but the author could have seen it (an upper bound: later joiners had fewer days).
const others = Math.max(0, members.length - 1);

async function report(label, Model, describe) {
  const docs = await Model.find({ views: { $gt: 0 } }).select('views createdAt author title content text type').lean();
  let total = 0;
  let ceilingTotal = 0;
  let oneEachTotal = 0;
  const rows = docs.map((d) => {
    const days = Math.max(1, Math.ceil((now - new Date(d.createdAt)) / DAY));
    const ceiling = others * days; // highest honest count under the new rule
    const oneEach = Math.min(d.views, others); // "every other member saw it once"
    total += d.views;
    ceilingTotal += Math.min(d.views, ceiling);
    oneEachTotal += oneEach;
    return { id: String(d._id), what: describe(d), views: d.views, days, ceiling, overCeilingBy: Math.max(0, d.views - ceiling) };
  });
  rows.sort((a, b) => b.overCeilingBy - a.overCeilingBy || b.views - a.views);
  console.log(`\n=== ${label}: ${docs.length} with views, ${total} views in total ===`);
  console.log(`If capped at the honest ceiling: ${ceilingTotal} (${total - ceilingTotal} impossible views)`);
  console.log(`If every other member had seen each one once: ${oneEachTotal}`);
  console.table(rows.slice(0, 25));
}

await report('Posts', Post, (p) => `${p.type}: ${(p.title || p.content || '').slice(0, 40)}`);
await report('Comments', Comment, (c) => (c.text || '').slice(0, 40));
console.log(`\nMembers: ${members.length}. No numbers were changed.`);
await disconnectDB();
