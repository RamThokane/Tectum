import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { start, stop, member, apiBase } from './helpers.js';

before(start);
after(stop);

const id = () => new mongoose.Types.ObjectId().toString();
const MIN = 60_000;

/** A 3-question test: single (2 marks, -0.5), multiple (2 marks), short numeric (1 mark, ±0.1). */
function sampleQuiz(overrides = {}) {
  const a = [id(), id(), id()];
  const b = [id(), id(), id()];
  const q1 = { _id: id(), type: 'single', text: 'First-line drug for absence seizures?', options: [{ _id: a[0], text: 'Ethosuximide' }, { _id: a[1], text: 'Phenytoin' }, { _id: a[2], text: 'Carbamazepine' }], correctAnswers: [a[0]], marks: 2, negativeMarks: 0.5, explanation: 'Ethosuximide blocks T-type Ca channels.' };
  const q2 = { _id: id(), type: 'multiple', text: 'Which are loop diuretics?', options: [{ _id: b[0], text: 'Furosemide' }, { _id: b[1], text: 'Bumetanide' }, { _id: b[2], text: 'Spironolactone' }], correctAnswers: [b[0], b[1]], marks: 2 };
  const q3 = { _id: id(), type: 'short', text: 'Normal arterial pH (to 1 decimal place)?', correctAnswers: ['7.4'], numericTolerance: 0.1, marks: 1 };
  return {
    body: {
      title: 'Pharmacology mock',
      description: 'Ten minutes',
      instructions: 'Answer all',
      category: 'Pharmacology',
      startTime: new Date(Date.now() - MIN).toISOString(),
      endTime: new Date(Date.now() + 60 * MIN).toISOString(),
      durationMinutes: 20,
      questions: [q1, q2, q3],
      settings: { resultVisibility: 'immediate', showAnswers: true, showLeaderboard: true },
      ...overrides,
    },
    q: { q1, q2, q3, a, b },
  };
}

async function publishedQuiz(organizer, overrides) {
  const { body, q } = sampleQuiz(overrides);
  const created = await organizer.api('POST', '/quizzes', body);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const pub = await organizer.api('POST', `/quizzes/${created.data.quiz._id}/publish`);
  assert.equal(pub.status, 200, JSON.stringify(pub.data));
  return { quiz: pub.data.quiz, q };
}

/** A participant's attempt helper: join, start, and calls that carry the session token. */
async function begin(p, quiz) {
  const j = await p.api('POST', '/quizzes/join', { code: quiz.accessCode.toLowerCase().replace(/(.{4})/, '$1 ') });
  assert.equal(j.status, 200, JSON.stringify(j.data));
  const s = await p.api('POST', `/quizzes/${quiz._id}/start`, { fullscreen: true });
  assert.equal(s.status, 201, JSON.stringify(s.data));
  const token = s.data.sessionToken;
  const call = async (method, path, body, tok = token) => {
    const res = await fetch(apiBase() + path, {
      method,
      headers: { Authorization: p.auth, 'Content-Type': 'application/json', ...(tok ? { 'X-Attempt-Session': tok } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  return { start: s.data, attemptId: s.data.attempt._id, call, token };
}

async function withAuth(extra) {
  const m = await member(extra);
  const { signToken } = await import('../src/utils/token.js');
  m.auth = `Bearer ${signToken(m.user)}`;
  return m;
}

/** A member Tectum approved to conduct tests. */
const host = (extra) => withAuth({ quizHost: 'approved', ...extra });

test('guests can never see, join or take a test', async () => {
  for (const [method, path] of [['GET', '/quizzes/mine'], ['POST', '/quizzes/join'], ['GET', '/attempts/mine'], ['POST', '/quizzes']]) {
    const r = await fetch(apiBase() + path, { method });
    assert.equal(r.status, 401, `${method} ${path}`);
  }
});

test('organizer: drafts can be incomplete; publish checks everything and makes an 8-character code', async () => {
  const org = await host();
  const draft = await org.api('POST', '/quizzes', { title: 'Half done', questions: [{ _id: id(), type: 'single', text: '', marks: 1 }] });
  assert.equal(draft.status, 201, JSON.stringify(draft.data));
  const pub = await org.api('POST', `/quizzes/${draft.data.quiz._id}/publish`);
  assert.equal(pub.status, 400);
  assert.ok(pub.data.problems.some((p) => /start and end/.test(p)));
  assert.ok(pub.data.problems.some((p) => /Question 1: write the question/.test(p)));

  const { quiz } = await publishedQuiz(org);
  assert.match(quiz.accessCode, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
  assert.equal(quiz.totalMarks, 5);
  // someone else can't open, edit or see results of it
  const other = await withAuth();
  assert.equal((await other.api('GET', `/quizzes/${quiz._id}`)).status, 404);
  assert.equal((await other.api('GET', `/quizzes/${quiz._id}/results`)).status, 404);
});

test('join: bad codes, organizer, not started yet, invite-only; questions never carry answers', async () => {
  const org = await host();
  const p = await withAuth();
  assert.equal((await p.api('POST', '/quizzes/join', { code: 'ZZZZZZZZ' })).status, 404);

  const later = await publishedQuiz(org, { startTime: new Date(Date.now() + 30 * MIN).toISOString(), endTime: new Date(Date.now() + 90 * MIN).toISOString() });
  const j = await p.api('POST', '/quizzes/join', { code: later.quiz.accessCode });
  assert.equal(j.data.eligibility.state, 'not_started');
  assert.ok(j.data.eligibility.startsAt);
  assert.equal((await p.api('POST', `/quizzes/${later.quiz._id}/start`)).status, 400);
  assert.equal(j.data.quiz.questions, undefined);

  const own = await org.api('POST', '/quizzes/join', { code: later.quiz.accessCode });
  assert.equal(own.data.eligibility.state, 'blocked');
  assert.match(own.data.eligibility.reason, /organised this test/);

  const invOnly = await publishedQuiz(org, { settings: { inviteOnly: true } });
  const ij = await p.api('POST', '/quizzes/join', { code: invOnly.quiz.accessCode });
  assert.match(ij.data.eligibility.reason, /only for members the organizer invited/);

  // must enter the code before opening the instructions
  const live = await publishedQuiz(org);
  assert.equal((await p.api('GET', `/quizzes/${live.quiz._id}/info`)).status, 403);
  const { start: s } = await begin(p, live.quiz);
  const json = JSON.stringify(s);
  assert.ok(!json.includes('correctAnswers') && !json.includes('explanation') && !json.includes('T-type'));
  assert.equal(s.questions.length, 3);
  assert.ok(new Date(s.attempt.expiresAt) - new Date(s.attempt.startedAt) <= 20 * MIN + 1000);
});

test('autosave, scoring (negative marks, all-or-nothing, numeric tolerance), rank and review', async () => {
  const org = await host();
  const { quiz, q } = await publishedQuiz(org);
  const p1 = await withAuth({ name: 'Asha Rao' });
  const p2 = await withAuth({ name: 'Ravi Iyer' });

  const t1 = await begin(p1, quiz);
  // a bogus option id is dropped; the real answers are saved
  let r = await t1.call('PATCH', `/attempts/${t1.attemptId}/answer`, { answers: [{ questionId: q.q1._id, selected: [q.a[0], 'nope'] }, { questionId: q.q2._id, selected: [q.b[0], q.b[1]] }, { questionId: q.q3._id, selected: ['7.45'] }] });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  r = await t1.call('POST', `/attempts/${t1.attemptId}/submit`);
  assert.equal(r.data.status, 'submitted');

  const t2 = await begin(p2, quiz);
  await t2.call('PATCH', `/attempts/${t2.attemptId}/answer`, { answers: [{ questionId: q.q1._id, selected: [q.a[1]] }, { questionId: q.q2._id, selected: [q.b[0]] }] });
  await t2.call('POST', `/attempts/${t2.attemptId}/submit`);

  const res1 = await p1.api('GET', `/attempts/${t1.attemptId}/result`);
  assert.equal(res1.data.released, true);
  assert.equal(res1.data.attempt.score, 5);
  assert.equal(res1.data.attempt.percentage, 100);
  assert.equal(res1.data.attempt.rank, 1);
  const res2 = await p2.api('GET', `/attempts/${t2.attemptId}/result`);
  // wrong single (-0.5), half of the multiple without partial marking (wrong = 0, no negatives set), blank short
  assert.equal(res2.data.attempt.score, -0.5);
  assert.equal(res2.data.attempt.negativeLost, 0.5);
  assert.equal(res2.data.attempt.rank, 2);
  assert.equal(res2.data.attempt.unattemptedCount, 1);
  assert.equal(res2.data.comparison.highest, 5);
  const review = res2.data.review.find((x) => x._id === q.q1._id);
  assert.deepEqual(review.correctAnswers, [q.a[0]]);
  assert.match(review.explanation, /T-type/);
  assert.equal(res2.data.leaderboard[0].user.name, 'Asha Rao');

  // the organizer: stats + CSV
  const results = await org.api('GET', `/quizzes/${quiz._id}/results`);
  assert.equal(results.data.stats.participants, 2);
  assert.equal(results.data.stats.highest, 5);
  assert.equal(results.data.stats.perQuestion[0].accuracy, 50);
  const csv = await fetch(`${apiBase()}/quizzes/${quiz._id}/results/export`, { headers: { Authorization: org.auth } });
  const text = await csv.text();
  assert.match(text, /Rank,Name,Handle/);
  assert.match(text, /Asha Rao/);

  // questions can't change any more
  const { body } = sampleQuiz();
  const edit = await org.api('PUT', `/quizzes/${quiz._id}`, { ...body, title: 'Renamed' });
  assert.equal(edit.status, 409);
  assert.match(edit.data.message, /questions/);
});

test('one tab only: requests without the session token are refused and logged', async () => {
  const org = await host();
  const { quiz, q } = await publishedQuiz(org);
  const p = await withAuth();
  const t = await begin(p, quiz);
  const r = await t.call('PATCH', `/attempts/${t.attemptId}/answer`, { answers: [{ questionId: q.q1._id, selected: [q.a[0]] }] }, 'wrong-token');
  assert.equal(r.status, 409);
  const { Attempt } = await import('../src/models/Attempt.js');
  const a = await Attempt.findById(t.attemptId).lean();
  assert.equal(a.violations[0].type, 'MULTIPLE_SESSION');
  assert.equal(a.status, 'in_progress');
});

test('strict mode: leaving full screen disqualifies at once; answers so far are kept; no rejoining; organizer can reinstate', async () => {
  const org = await host();
  const { quiz, q } = await publishedQuiz(org);
  const p = await withAuth();
  const t = await begin(p, quiz);
  await t.call('PATCH', `/attempts/${t.attemptId}/answer`, { answers: [{ questionId: q.q1._id, selected: [q.a[0]] }] });
  const v = await t.call('POST', `/attempts/${t.attemptId}/violation`, { type: 'FULLSCREEN_EXIT', meta: 'Esc' });
  assert.equal(v.data.status, 'disqualified');
  assert.match(v.data.disqualifiedReason, /left full-screen mode at \d\d:\d\d:\d\d/);
  // further answers are refused
  assert.equal((await t.call('PATCH', `/attempts/${t.attemptId}/answer`, { answers: [{ questionId: q.q2._id, selected: [q.b[0]] }] })).status, 409);
  // can't come back
  const again = await p.api('POST', '/quizzes/join', { code: quiz.accessCode });
  assert.match(again.data.eligibility.reason, /disqualified/);
  // the organizer sees the log, and the score from what was answered
  const detail = await org.api('GET', `/quizzes/${quiz._id}/attempts/${t.attemptId}`);
  assert.equal(detail.data.attempt.status, 'disqualified');
  assert.equal(detail.data.attempt.violations[0].type, 'FULLSCREEN_EXIT');
  assert.equal(detail.data.attempt.score, 2);
  // the member's flag counter went up, but no automatic ban
  const { User } = await import('../src/models/User.js');
  const u = await User.findById(p.user._id).select('+quizFlags +quizBanned').lean();
  assert.equal(u.quizFlags, 1);
  assert.equal(u.quizBanned, false);
  // reinstate for a retake
  const re = await org.api('POST', `/quizzes/${quiz._id}/attempts/${t.attemptId}/reinstate`, { mode: 'retake', note: 'Pressed Esc by accident' });
  assert.equal(re.data.status, 'voided');
  const j = await p.api('POST', '/quizzes/join', { code: quiz.accessCode });
  assert.equal(j.data.eligibility.state, 'ready');
});

test('allowed exits: a warning first, disqualified after the allowance; tab switches counted separately', async () => {
  const org = await host();
  const { quiz } = await publishedQuiz(org, { settings: { allowedFullscreenExits: 1, allowedTabSwitches: 0, resultVisibility: 'immediate' } });
  const p = await withAuth();
  const t = await begin(p, quiz);
  const w = await t.call('POST', `/attempts/${t.attemptId}/violation`, { type: 'FULLSCREEN_EXIT' });
  assert.equal(w.data.status, 'in_progress');
  assert.deepEqual(w.data.warning, { kind: 'fullscreen', used: 1, allowed: 1 });
  // logged-only types don't count
  const s = await t.call('POST', `/attempts/${t.attemptId}/violation`, { type: 'SHORTCUT_BLOCKED', meta: 'Ctrl+C' });
  assert.equal(s.data.status, 'in_progress');
  const d = await t.call('POST', `/attempts/${t.attemptId}/violation`, { type: 'TAB_SWITCH' });
  assert.equal(d.data.status, 'disqualified');
});

test('one action that fires two signals counts once; leaving again later still counts', async () => {
  const org = await host();
  const { quiz } = await publishedQuiz(org, { settings: { allowedTabSwitches: 1, resultVisibility: 'immediate' } });
  const p = await withAuth();
  const t = await begin(p, quiz);
  const first = await t.call('POST', `/attempts/${t.attemptId}/violation`, { type: 'TAB_SWITCH', meta: 'page hidden' });
  assert.deepEqual(first.data.warning, { kind: 'tab', used: 1, allowed: 1 });
  // the same leave, a moment later ("page closed" after "page hidden")
  const echo = await t.call('POST', `/attempts/${t.attemptId}/violation`, { type: 'WINDOW_BLUR', meta: 'left the page' });
  assert.equal(echo.data.status, 'in_progress');
  const { Attempt } = await import('../src/models/Attempt.js');
  const a = await Attempt.findById(t.attemptId).lean();
  assert.deepEqual(a.violations.map((v) => v.counted), [true, false]);
  assert.equal(a.tabSwitches, 1);
  // a real second leave, later on
  await Attempt.updateOne({ _id: t.attemptId }, { $set: { 'violations.0.at': new Date(Date.now() - 60_000), 'violations.1.at': new Date(Date.now() - 60_000) } });
  const again = await t.call('POST', `/attempts/${t.attemptId}/violation`, { type: 'TAB_SWITCH', meta: 'page hidden' });
  assert.equal(again.data.status, 'disqualified');
});

test('results after the window: hidden until the end; answers hidden when the organizer says so', async () => {
  const org = await host();
  const { quiz, q } = await publishedQuiz(org, { settings: { resultVisibility: 'after_end', showAnswers: false } });
  const p = await withAuth();
  const t = await begin(p, quiz);
  await t.call('PATCH', `/attempts/${t.attemptId}/answer`, { answers: [{ questionId: q.q1._id, selected: [q.a[0]] }] });
  await t.call('POST', `/attempts/${t.attemptId}/submit`);
  let r = await p.api('GET', `/attempts/${t.attemptId}/result`);
  assert.equal(r.data.released, false);
  assert.ok(r.data.availableAt);
  assert.equal(r.data.attempt.score, undefined);
  // the window closes
  const { Quiz } = await import('../src/models/Quiz.js');
  await Quiz.updateOne({ _id: quiz._id }, { endTime: new Date(Date.now() - 1000) });
  r = await p.api('GET', `/attempts/${t.attemptId}/result`);
  assert.equal(r.data.released, true);
  assert.equal(r.data.attempt.score, 2);
  assert.equal(r.data.review[0].correctAnswers, undefined);
  assert.equal(r.data.review[0].explanation, undefined);
});

test('time: answers after the deadline are refused and expired attempts are auto-submitted by the sweep', async () => {
  const org = await host();
  const { quiz, q } = await publishedQuiz(org);
  const p = await withAuth();
  const t = await begin(p, quiz);
  await t.call('PATCH', `/attempts/${t.attemptId}/answer`, { answers: [{ questionId: q.q1._id, selected: [q.a[0]] }] });
  const { Attempt } = await import('../src/models/Attempt.js');
  await Attempt.updateOne({ _id: t.attemptId }, { expiresAt: new Date(Date.now() - 10_000) });
  const late = await t.call('PATCH', `/attempts/${t.attemptId}/answer`, { answers: [{ questionId: q.q2._id, selected: [q.b[0]] }] });
  assert.equal(late.status, 409);
  const a = await Attempt.findById(t.attemptId).lean();
  assert.equal(a.status, 'auto_submitted');
  assert.equal(a.score, 2);

  // the sweep finds attempts nobody touches any more
  const t2 = await begin(await withAuth(), quiz);
  await Attempt.updateOne({ _id: t2.attemptId }, { expiresAt: new Date(Date.now() - 10_000) });
  const { sweepExpiredAttempts } = await import('../src/utils/quizAttempts.js');
  assert.ok((await sweepExpiredAttempts()) >= 1);
  assert.equal((await Attempt.findById(t2.attemptId).lean()).status, 'auto_submitted');
});

test('iPhone mode: allowed on phones (recorded for the organizer), refused on computers; leaving the page counts', async () => {
  const org = await host();
  const { quiz } = await publishedQuiz(org);
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';
  const startAs = async (p, ua) => {
    await p.api('POST', '/quizzes/join', { code: quiz.accessCode });
    const r = await fetch(`${apiBase()}/quizzes/${quiz._id}/start`, { method: 'POST', headers: { Authorization: p.auth, 'Content-Type': 'application/json', 'User-Agent': ua }, body: JSON.stringify({ mode: 'phone' }) });
    return { status: r.status, data: await r.json() };
  };
  // full screen switched off for now: computers start without it too
  const { FULLSCREEN_REQUIRED } = await import('../src/utils/quizAttempts.js');
  const laptop = await withAuth();
  assert.equal((await startAs(laptop, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/150.0')).status, FULLSCREEN_REQUIRED ? 400 : 201);

  const p = await withAuth();
  const s = await startAs(p, IPHONE);
  assert.equal(s.status, 201, JSON.stringify(s.data));
  const v = await fetch(`${apiBase()}/attempts/${s.data.attempt._id}/violation`, {
    method: 'POST',
    headers: { Authorization: p.auth, 'Content-Type': 'application/json', 'X-Attempt-Session': s.data.sessionToken },
    body: JSON.stringify({ type: 'TAB_SWITCH', meta: 'left the page (app or tab switched)' }),
  }).then((r) => r.json());
  assert.equal(v.status, 'disqualified'); // strict by default: the first time disqualifies
  const res = await org.api('GET', `/quizzes/${quiz._id}/results`);
  assert.equal(res.data.attempts.find((a) => a._id === s.data.attempt._id).mode, 'phone');
});

test('invite sends a notification with the code; import reads CSV with row errors; wrong codes are rate limited', async () => {
  const org = await host({ name: 'Dr Meera Shah' });
  const { quiz } = await publishedQuiz(org);
  const friend = await withAuth({ name: 'Kabir Sen' });
  const inv = await org.api('POST', `/quizzes/${quiz._id}/invite`, { userIds: [friend.user._id] });
  assert.equal(inv.data.invited.length, 1);
  const notes = await friend.api('GET', '/notifications');
  const n = notes.data.notifications.find((x) => x.type === 'quiz_invite');
  assert.match(n.note, new RegExp(quiz.accessCode));
  assert.equal(n.link, `/quiz/join?code=${quiz.accessCode}`);

  const people = await org.api('GET', '/quizzes/people?q=kabir');
  assert.equal(people.data.users[0].name, 'Kabir Sen');
  assert.equal(people.data.users[0].email, undefined);

  const draft = await org.api('POST', '/quizzes', { title: 'Import test' });
  const csv = [
    'type,question,option1,option2,option3,option4,option5,option6,correct,marks,negative_marks,explanation,image,time_limit_sec,tolerance',
    'single,"Drug of choice for MRSA, IV?",Vancomycin,Ceftriaxone,,,,,1,4,1,"Glycopeptide",,,',
    'truefalse,Aspirin is an NSAID,,,,,,,True,1,,,,,',
    'short,Normal serum sodium (mmol/L)?,,,,,,,140,1,,,,,5',
    'single,Missing answer,A,B,,,,,,1,,,,,',
  ].join('\n');
  const imp = await org.api('POST', `/quizzes/${draft.data.quiz._id}/import`, { format: 'csv', content: csv });
  assert.equal(imp.data.questions.length, 3);
  assert.equal(imp.data.questions[0].options.length, 2);
  assert.equal(imp.data.questions[0].text, 'Drug of choice for MRSA, IV?');
  assert.equal(imp.data.errors.length, 1);
  assert.match(imp.data.errors[0], /Row 5/);

  const guesser = await withAuth();
  let last;
  for (let i = 0; i < 11; i++) last = await guesser.api('POST', '/quizzes/join', { code: `WRONG${i}XX` });
  assert.equal(last.status, 429);
});
