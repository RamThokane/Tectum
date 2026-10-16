// Fills the database with demo users, posts, comments and follows.
// Usage: npm run seed            (skips if demo data already exists)
//        npm run seed -- --reset (removes previous demo data first)
import bcrypt from 'bcryptjs';
import { connectDBForScript, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Post } from '../src/models/Post.js';
import { Comment } from '../src/models/Comment.js';
import { Notification } from '../src/models/Notification.js';
import { saveFile } from '../src/utils/storage.js';
import { rankAtFor } from '../src/utils/premium.js';

const DEMO_DOMAIN = '@demo.tectum.app';
const DEMO_PASSWORD = 'demo1234';
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);

/** Builds a small, valid single-page PDF containing the given lines of text. */
function makePdf(title, lines) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const text = [
    'BT /F1 18 Tf 60 780 Td (' + esc(title) + ') Tj ET',
    ...lines.map((l, i) => `BT /F1 11 Tf 60 ${745 - i * 18} Td (${esc(l)}) Tj ET`),
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

const USERS = [
  { key: 'priya', name: 'Dr. Priya Sharma', role: 'doctor', verificationStatus: 'verified', isPremium: true, premiumSince: hoursAgo(24 * 20), institution: 'City General Hospital', specialtyTags: ['cardiology', 'internal-medicine'], bio: 'Interventional cardiology fellow. Teaching ECGs one post at a time.' },
  { key: 'arjun', name: 'Arjun Mehta', role: 'student', verificationStatus: 'verified', institution: 'State Medical College', specialtyTags: ['anatomy', 'physiology', 'cardiology'], bio: "2nd-year med student. I make notes so you don't have to." },
  { key: 'maria', name: 'Maria Lopez, RN', role: 'nurse', verificationStatus: 'verified', institution: 'Riverside Medical Center', specialtyTags: ['critical-care', 'emergency-medicine'], bio: 'ICU nurse, 8 years. Sepsis bundles and early warning scores.' },
  { key: 'kenji', name: 'Dr. Kenji Tanaka', role: 'researcher', verificationStatus: 'verified', institution: 'Institute of Clinical Research', specialtyTags: ['oncology', 'research'], bio: 'Clinical trials in solid tumours. Happy to talk study design.' },
  { key: 'sara', name: 'Sara Ahmed', role: 'student', verificationStatus: 'unverified', institution: 'Northfield University', specialtyTags: ['pediatrics', 'pharmacology'], bio: 'Final-year student heading into paediatrics.' },
  { key: 'daniel', name: 'Dr. Daniel Okafor', role: 'doctor', verificationStatus: 'verified', institution: "Lakeside Children's Hospital", specialtyTags: ['pediatrics', 'emergency-medicine'], bio: 'Paediatric emergency physician.' },
];

const POSTS = [
  { author: 'priya', h: 3, type: 'text', title: 'Right-sided leads in inferior STEMI: a 30-second habit that changes management', content: 'ECG pearl: in suspected inferior STEMI, always record right-sided leads. ST elevation in V4R changes management: avoid nitrates and be generous with fluids. #cardiology #ecg', tags: ['cardiology', 'ecg'] },
  {
    author: 'priya', h: 20, type: 'case_study', title: 'Inferior STEMI with Hypotension in a 50s Smoker', tags: ['cardiology', 'emergency-medicine'],
    content: 'What would you do next?',
    caseStudy: {
      age: '50s', sex: 'male',
      chiefComplaint: 'Crushing central chest pain for 2 hours, radiating to the jaw',
      history: 'Male in his 50s, smoker, hypertensive. Pain started at rest, associated with sweating and nausea.',
      examinationFindings: 'HR 52, BP 88/60, JVP raised, clear lung fields.',
      investigations: 'ECG: ST elevation II, III, aVF with ST depression in I, aVL. V4R: 1.5 mm ST elevation. Troponin pending.',
      diagnosis: 'Inferior STEMI with right ventricular involvement',
      learningPoint: 'Hypotension + clear lungs + raised JVP in inferior MI = think RV infarct. Nitrates can cause profound hypotension.',
      mcqTips: 'Inferior MI + hypotension + clear lungs + raised JVP = RV infarct\nRight coronary artery is the usual culprit in inferior MI\nST elevation in V4R is the most sensitive ECG sign of RV infarct\nNitrates and diuretics are contraindicated; give IV fluids',
    },
  },
  {
    author: 'arjun', h: 30, type: 'notes', title: 'Renal Physiology: Nephron Transport on One Page', tags: ['physiology', 'nephrology'], content: 'My one-page summary of nephron transport. Free to use, corrections welcome!',
    file: { name: 'Renal Physiology - Nephron Transport.pdf', title: 'Renal Physiology: Nephron Transport', lines: ['PCT: ~65% Na+ and water reabsorbed; glucose and amino acids via SGLT.', 'Loop of Henle: thick ascending limb, NKCC2 (target of loop diuretics).', 'DCT: NCC co-transporter (target of thiazides); PTH increases Ca2+ uptake.', 'Collecting duct: ENaC (aldosterone), aquaporin-2 (ADH).', 'Countercurrent multiplication creates the medullary gradient.'] },
  },
  {
    author: 'maria', h: 8, type: 'case_study', title: 'Severe DKA in a Young Adult after Missed Insulin', tags: ['critical-care', 'endocrinology'],
    caseStudy: {
      age: '20s', sex: 'female',
      chiefComplaint: 'Vomiting, abdominal pain and drowsiness for 1 day',
      history: 'Female in her 20s with type 1 diabetes, missed insulin doses during a viral illness.',
      examinationFindings: 'Kussmaul breathing, dry mucous membranes, HR 124, GCS 13.',
      investigations: 'Glucose 28 mmol/L, pH 7.08, bicarbonate 7, ketones 5.8 mmol/L, K+ 5.6.',
      diagnosis: 'Severe diabetic ketoacidosis',
      learningPoint: 'Potassium looks high but total body K+ is depleted. It will fall fast once insulin starts, so monitor hourly and replace early.',
    },
  },
  { author: 'maria', h: 50, type: 'text', title: 'Count the respiratory rate for a full minute', content: 'Night-shift reminder: a rising respiratory rate is often the earliest sign of deterioration, and the vital sign we most often estimate instead of count. Count it for a full minute. #nursing #criticalcare', tags: ['nursing', 'critical-care'] },
  {
    author: 'kenji', h: 70, type: 'notes', title: 'Critical Appraisal of RCTs: Teaching Cheat Sheet', tags: ['research', 'oncology'], content: 'Cheat sheet I use when teaching critical appraisal of RCTs.',
    file: { name: 'Critical Appraisal of RCTs - Cheat Sheet.pdf', title: 'Critical Appraisal of RCTs', lines: ['1. Was randomisation concealed?', '2. Were groups similar at baseline?', '3. Blinding: participants, clinicians, outcome assessors?', '4. Intention-to-treat analysis? Loss to follow-up < 20%?', '5. Effect size: ARR, RRR and NNT = 1 / ARR.', '6. Are the results applicable to my patients?'] },
  },
  { author: 'kenji', h: 12, type: 'text', title: 'What a p-value is (and is not)', content: 'Quick stats refresher: a p-value is NOT the probability that the null hypothesis is true. It is the probability of data at least this extreme if the null were true. #research #statistics', tags: ['research', 'statistics'] },
  {
    author: 'daniel', h: 16, type: 'case_study', title: 'Episodic Crying and a Sausage-Shaped Mass in an Infant', tags: ['pediatrics', 'emergency-medicine'],
    caseStudy: {
      age: '9 months', sex: 'male',
      chiefComplaint: 'Episodic inconsolable crying and drawing up of legs',
      history: 'Infant around 9 months old. Episodes every 15 to 20 minutes, lethargic in between. One episode of vomiting.',
      examinationFindings: 'Pale and lethargic between episodes; sausage-shaped mass in the right upper quadrant.',
      investigations: 'Ultrasound: target sign in the right abdomen.',
      diagnosis: 'Ileocolic intussusception',
      learningPoint: '"Redcurrant jelly" stool is a late sign. Do not wait for it. Lethargy between colicky episodes should prompt an ultrasound.',
    },
  },
  {
    author: 'sara', h: 40, type: 'notes', title: 'Paediatric Drug Dosing Basics for Finals', tags: ['pharmacology', 'pediatrics'], content: 'Paediatric drug dosing basics I made for my finals revision.',
    file: { name: 'Paediatric Dosing Basics.pdf', title: 'Paediatric Dosing Basics', lines: ['Always dose by weight (mg/kg) and check against the adult maximum.', 'Estimated weight (1-10 yrs): (age + 4) x 2 kg.', 'Paracetamol: 15 mg/kg per dose, max 4 doses in 24 h.', 'Ibuprofen: 5-10 mg/kg per dose, three times daily with food.', 'Double-check decimal points: 10-fold errors are the most common.'] },
  },
  { author: 'sara', h: 5, type: 'text', content: 'Anyone have a good mnemonic for the cranial nerve foramina? My anatomy exam is in two weeks! #anatomy', tags: ['anatomy'] },
  { author: 'arjun', h: 1, type: 'text', title: 'My first real murmur on the wards', content: 'Just saw my first real murmur on the wards: a pansystolic murmur at the apex radiating to the axilla. Textbook mitral regurgitation. Auscultation practice pays off! #cardiology', tags: ['cardiology'] },
];

const COMMENTS = [
  { post: 1, author: 'arjun', text: 'Great case. I would have given GTN without thinking. Lesson learned!' },
  { post: 1, author: 'maria', text: 'We see this in the ED. Fluid bolus and early cath lab activation.' },
  { post: 3, author: 'priya', text: 'Excellent point about potassium. Also check for a precipitating infection.' },
  { post: 3, author: 'sara', text: 'Is there a threshold of K+ below which you delay insulin?' },
  { post: 3, author: 'maria', text: '@Sara yes: most protocols hold insulin if K+ < 3.5 until replacement has started.' },
  { post: 9, author: 'arjun', text: '"Oh Oh Oh To Touch And Feel..." for the nerves, but for foramina I just use flashcards.' },
  { post: 7, author: 'sara', text: 'Saving this for my paediatrics rotation, thank you!' },
  { post: 2, author: 'sara', text: 'These notes are so clear. Thanks for sharing.' },
];

const FOLLOWS = { arjun: ['priya', 'kenji', 'maria'], sara: ['daniel', 'priya', 'arjun'], maria: ['priya', 'daniel'], priya: ['maria', 'kenji'], kenji: ['priya'], daniel: ['sara', 'maria'] };
const LIKES = { 0: ['arjun', 'sara', 'maria'], 1: ['arjun', 'maria', 'kenji', 'daniel'], 2: ['sara', 'priya'], 3: ['priya', 'daniel'], 5: ['arjun', 'priya'], 7: ['sara', 'maria', 'priya'], 8: ['daniel'], 10: ['priya', 'sara'] };
const BOOKMARKS = { 2: ['sara', 'maria'], 5: ['arjun', 'sara'], 8: ['arjun'] };

async function main() {
  await connectDBForScript();
  const reset = process.argv.includes('--reset');
  const demoFilter = { email: { $regex: `${DEMO_DOMAIN.replace(/\./g, '\\.')}$` } };
  const existing = await User.find(demoFilter).select('_id');

  if (existing.length && !reset) {
    console.log('Demo data already exists. Run with --reset to recreate it.');
    return;
  }
  if (existing.length) {
    const ids = existing.map((u) => u._id);
    const posts = await Post.find({ author: { $in: ids } }).select('_id');
    await Comment.deleteMany({ $or: [{ author: { $in: ids } }, { post: { $in: posts.map((p) => p._id) } }] });
    await Notification.deleteMany({ $or: [{ sourceUser: { $in: ids } }, { recipient: { $in: ids } }] });
    await Post.deleteMany({ author: { $in: ids } });
    await User.updateMany({}, { $pull: { followers: { $in: ids }, following: { $in: ids } } });
    await User.deleteMany({ _id: { $in: ids } });
    console.log('Removed previous demo data.');
  }

  const password = await bcrypt.hash(DEMO_PASSWORD, 12);
  const users = {};
  for (const { key, ...u } of USERS) {
    const at = hoursAgo(24 * 30);
    [users[key]] = await User.create(
      [{ ...u, email: `${key}${DEMO_DOMAIN}`, password, createdAt: at, updatedAt: at }],
      { timestamps: false }
    );
  }

  const posts = [];
  for (const p of POSTS) {
    const at = hoursAgo(p.h);
    const doc = { author: users[p.author]._id, type: p.type, title: p.title || '', content: p.content || '', tags: p.tags, caseStudy: p.caseStudy, createdAt: at, updatedAt: at, rankAt: rankAtFor(users[p.author], at) };
    if (p.file) {
      const { url } = await saveFile({ originalname: p.file.name, buffer: makePdf(p.file.title, p.file.lines) }, { folder: 'notes' });
      doc.notesFile = { url, fileName: p.file.name, fileType: 'pdf' };
    }
    const [created] = await Post.create([doc], { timestamps: false });
    posts.push(created);
  }

  const notifications = [];
  const notify = (recipient, type, sourceUser, post, h) => {
    if (String(recipient) !== String(sourceUser)) notifications.push({ recipient, type, sourceUser, post, createdAt: hoursAgo(h), isRead: h > 24 });
  };

  for (const [i, keys] of Object.entries(LIKES)) {
    const post = posts[i];
    post.likes = keys.map((k) => users[k]._id);
    keys.forEach((k) => notify(post.author, 'like', users[k]._id, post._id, POSTS[i].h / 2));
  }
  for (const [i, keys] of Object.entries(BOOKMARKS)) {
    const post = posts[i];
    post.bookmarks = keys.map((k) => users[k]._id);
    keys.forEach((k) => notify(post.author, 'notes_saved', users[k]._id, post._id, POSTS[i].h / 2));
  }
  for (const c of COMMENTS) {
    const post = posts[c.post];
    const h = POSTS[c.post].h / 3;
    await Comment.create({ post: post._id, author: users[c.author]._id, text: c.text, createdAt: hoursAgo(h) });
    post.commentCount += 1;
    notify(post.author, 'comment', users[c.author]._id, post._id, h);
  }
  await Promise.all(posts.map((p) => p.save({ timestamps: false })));

  for (const [from, targets] of Object.entries(FOLLOWS)) {
    for (const to of targets) {
      await User.updateOne({ _id: users[from]._id }, { $addToSet: { following: users[to]._id } });
      await User.updateOne({ _id: users[to]._id }, { $addToSet: { followers: users[from]._id } });
      notify(users[to]._id, 'follow', users[from]._id, undefined, 200);
    }
  }
  await Notification.insertMany(notifications);

  console.log(`Created ${USERS.length} demo users, ${posts.length} posts and ${COMMENTS.length} comments.`);
  console.log(`Demo logins: priya${DEMO_DOMAIN}, arjun${DEMO_DOMAIN}, ... (password: ${DEMO_PASSWORD})`);
}

main()
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());

