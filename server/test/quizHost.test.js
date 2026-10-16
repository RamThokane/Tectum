import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { start, stop, member, apiBase } from './helpers.js';

before(start);
after(stop);

const id = () => new mongoose.Types.ObjectId().toString();
const MIN = 60_000;
const APPLICATION = { orgName: 'BrainRx', about: 'Weekly NEET-PG mock tests for final-year students', phone: '+91 98765 43210', website: 'https://brainrx.example', acceptTerms: true };

function quizBody(overrides = {}) {
  const o = [id(), id()];
  return {
    title: 'Anatomy weekly',
    startTime: new Date(Date.now() - MIN).toISOString(),
    endTime: new Date(Date.now() + 60 * MIN).toISOString(),
    durationMinutes: 10,
    questions: [{ _id: id(), type: 'single', text: 'Nerve supply of deltoid?', options: [{ _id: o[0], text: 'Axillary' }, { _id: o[1], text: 'Radial' }], correctAnswers: [o[0]], marks: 4 }],
    settings: { listed: true, resultVisibility: 'immediate', showLeaderboard: true },
    ...overrides,
  };
}

async function publish(org, overrides) {
  const c = await org.api('POST', '/quizzes', quizBody(overrides));
  assert.equal(c.status, 201, JSON.stringify(c.data));
  const p = await org.api('POST', `/quizzes/${c.data.quiz._id}/publish`);
  assert.equal(p.status, 200, JSON.stringify(p.data));
  return p.data.quiz;
}

test('sign-up offers Medical Student or Doctor, and can apply to conduct tests', async () => {
  const { signEmailProof } = await import('../src/controllers/authController.js');
  const signup = (email, extra) =>
    fetch(`${apiBase()}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Asha Rao', email, emailProof: signEmailProof(email), password: 'Testing#2026x', role: 'student', course: 'mbbs', country: 'IN', acceptTerms: true, ...extra }),
    }).then(async (r) => ({ status: r.status, data: await r.json() }));

  assert.equal((await signup('nurse@test.local', { role: 'nurse' })).status, 400);
  // the hosting terms must be accepted
  assert.equal((await signup('noterms@test.local', { hostApplication: { ...APPLICATION, acceptTerms: false } })).status, 400);

  const r = await signup('brainrx@test.local', { hostApplication: APPLICATION });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.user.quizHost, 'pending');
  assert.equal(r.data.user.isQuizHost, false);

  // pending: can't create a test yet
  const auth = { Authorization: `Bearer ${r.data.token}`, 'Content-Type': 'application/json' };
  const create = await fetch(`${apiBase()}/quizzes`, { method: 'POST', headers: auth, body: JSON.stringify(quizBody()) });
  assert.equal(create.status, 403);
  assert.match((await create.json()).message, /waiting for approval/);
});

test('admins see applications and approve them; the applicant is told and can host', async () => {
  const admin = await member({ isAdmin: true });
  const applicant = await member({ name: 'BrainRx' });
  assert.equal((await applicant.api('POST', '/quizzes', quizBody())).status, 403);

  assert.equal((await applicant.api('POST', '/quizzes/host/apply', { ...APPLICATION, about: 'short' })).status, 400);
  const apply = await applicant.api('POST', '/quizzes/host/apply', APPLICATION);
  assert.equal(apply.status, 201, JSON.stringify(apply.data));
  assert.equal((await applicant.api('POST', '/quizzes/host/apply', APPLICATION)).status, 409);
  assert.equal((await applicant.api('GET', '/quizzes/host/status')).data.status, 'pending');

  // members can't see the queue
  assert.equal((await applicant.api('GET', '/admin/quiz-hosts')).status, 403);
  const list = await admin.api('GET', '/admin/quiz-hosts');
  const app = list.data.applications.find((a) => String(a.user._id) === String(applicant.user._id));
  assert.equal(app.phone, '+91 98765 43210');
  assert.equal(app.orgName, 'BrainRx');

  const ok = await admin.api('POST', `/admin/quiz-hosts/${app._id}`, { status: 'approved' });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  const notes = await applicant.api('GET', '/notifications');
  assert.ok(notes.data.notifications.some((n) => n.type === 'quiz_host' && /can now conduct tests/.test(n.note)));

  const status = await applicant.api('GET', '/quizzes/host/status');
  assert.equal(status.data.canHost, true);
  assert.equal(status.data.freeLeft, 2);
  // the first two tests are free, the third is chargeable
  const t1 = await publish(applicant);
  const t2 = await publish(applicant);
  const t3 = await publish(applicant);
  assert.deepEqual([t1.chargeable, t2.chargeable, t3.chargeable], [false, false, true]);
  assert.equal((await applicant.api('GET', '/quizzes/host/status')).data.freeLeft, 0);

  // a profile shows "conducts tests" publicly, the raw status only to the member
  const seen = await admin.api('GET', `/users/${applicant.user._id}`);
  assert.equal(seen.data.user.isQuizHost, true);
  assert.equal(seen.data.user.quizHost, undefined);
});

test('Quizzes directory and a host Tests tab: live first, then upcoming by date, then past; private tests hidden', async () => {
  const org = await member({ name: 'Grey Matter Academy', quizHost: 'approved' });
  const viewer = await member();
  const later = await publish(org, { title: 'Later', startTime: new Date(Date.now() + 120 * MIN).toISOString(), endTime: new Date(Date.now() + 180 * MIN).toISOString() });
  const sooner = await publish(org, { title: 'Sooner', startTime: new Date(Date.now() + 30 * MIN).toISOString(), endTime: new Date(Date.now() + 90 * MIN).toISOString() });
  const live = await publish(org, { title: 'Live now' });
  await publish(org, { title: 'Private', settings: { listed: false } });
  const ended = await publish(org, { title: 'Last week' });
  const { Quiz } = await import('../src/models/Quiz.js');
  await Quiz.updateOne({ _id: ended._id }, { startTime: new Date(Date.now() - 3 * 86400_000), endTime: new Date(Date.now() - 2 * 86400_000) });

  const hosts = await viewer.api('GET', '/quizzes/hosts');
  const row = hosts.data.hosts.find((h) => String(h._id) === String(org.user._id));
  assert.deepEqual([row.live, row.upcoming, row.past], [1, 2, 1]);

  const tab = await viewer.api('GET', `/quizzes/by/${org.user._id}`);
  assert.deepEqual(tab.data.upcoming.map((t) => t.title), ['Live now', 'Sooner', 'Later']);
  assert.deepEqual(tab.data.past.map((t) => t.title), ['Last week']);
  assert.ok(!JSON.stringify(tab.data).includes('Private'));
  assert.ok(!JSON.stringify(tab.data).includes('correctAnswers'));
  assert.equal(tab.data.upcoming[0].phase, 'live');
  assert.ok([live, sooner, later].every(Boolean));
});

test('register -> pending -> host accepts -> the member can start; the leaderboard shows once it ends', async () => {
  const org = await member({ name: 'BrainRx', quizHost: 'approved' });
  const p = await member({ name: 'Riya Kulkarni' });
  const stranger = await member();
  const quiz = await publish(org, { settings: { listed: true, resultVisibility: 'immediate', showLeaderboard: true, maxParticipants: 1 } });

  // without being accepted: the code doesn't let them in, and the test page can't open
  const j = await p.api('POST', '/quizzes/join', { code: quiz.accessCode });
  assert.equal(j.data.eligibility.state, 'blocked');
  assert.equal(j.data.eligibility.needsRegistration, true);
  assert.equal((await p.api('GET', `/quizzes/${quiz._id}/info`)).status, 403);
  assert.equal((await p.api('POST', `/quizzes/${quiz._id}/start`)).status, 403);

  assert.equal((await p.api('POST', `/quizzes/${quiz._id}/register`, { name: 'R', college: '' })).status, 400);
  const reg = await p.api('POST', `/quizzes/${quiz._id}/register`, { name: 'Riya Kulkarni', college: 'BJ Medical College, Pune' });
  assert.equal(reg.status, 201, JSON.stringify(reg.data));
  assert.equal(reg.data.registration.status, 'pending');
  const details = await p.api('GET', `/quizzes/${quiz._id}/details`);
  assert.equal(details.data.quiz.registration.status, 'pending');
  assert.equal(details.data.leaderboard, null);
  const mine = await p.api('GET', '/quizzes/registrations/mine');
  assert.equal(mine.data.tests[0].registration.status, 'pending');

  // the host is told, and only the host sees the requests
  const hostNotes = await org.api('GET', '/notifications');
  const req = hostNotes.data.notifications.find((n) => n.type === 'quiz_request');
  assert.match(req.note, /Riya Kulkarni \(BJ Medical College, Pune\)/);
  assert.equal(req.link, `/quiz/${quiz._id}/manage?tab=registrations`);
  assert.equal((await p.api('GET', `/quizzes/${quiz._id}/registrations`)).status, 404);
  const regs = await org.api('GET', `/quizzes/${quiz._id}/registrations`);
  assert.equal(regs.data.counts.pending, 1);

  const s2 = await stranger.api('POST', `/quizzes/${quiz._id}/register`, { name: 'Someone Else', college: 'AIIMS Delhi' });
  const regs2 = await org.api('GET', `/quizzes/${quiz._id}/registrations`);
  // max 1 participant: accepting both is refused
  const both = await org.api('POST', `/quizzes/${quiz._id}/registrations`, { ids: regs2.data.registrations.map((r) => r._id), action: 'accept' });
  assert.equal(both.status, 400);
  assert.match(both.data.message, /1 participants/);

  const acc = await org.api('POST', `/quizzes/${quiz._id}/registrations`, { ids: [reg.data.registration._id], action: 'accept' });
  assert.equal(acc.data.changed, 1);
  const rej = await org.api('POST', `/quizzes/${quiz._id}/registrations`, { ids: [s2.data.registration._id], action: 'reject' });
  assert.equal(rej.data.changed, 1);
  assert.equal((await stranger.api('POST', `/quizzes/${quiz._id}/register`, { name: 'Someone Else', college: 'AIIMS Delhi' })).status, 403);

  const pNotes = await p.api('GET', '/notifications');
  const accepted = pNotes.data.notifications.find((n) => n.type === 'quiz_registration');
  assert.match(accepted.note, /You're registered/);
  assert.equal(accepted.link, `/quiz/${quiz._id}/details`);

  // accepted: the test page opens and the test starts (no code needed)
  const info = await p.api('GET', `/quizzes/${quiz._id}/info`);
  assert.equal(info.status, 200);
  assert.equal(info.data.eligibility.state, 'ready');
  const startRes = await p.api('POST', `/quizzes/${quiz._id}/start`, { fullscreen: true });
  assert.equal(startRes.status, 201, JSON.stringify(startRes.data));
  const headers = { Authorization: `Bearer ${(await import('../src/utils/token.js')).signToken(p.user)}`, 'Content-Type': 'application/json', 'X-Attempt-Session': startRes.data.sessionToken };
  const q1 = startRes.data.questions[0];
  await fetch(`${apiBase()}/attempts/${startRes.data.attempt._id}/answer`, { method: 'PATCH', headers, body: JSON.stringify({ answers: [{ questionId: q1._id, selected: [q1.options.find((o) => o.text === 'Axillary')._id] }] }) });
  const sub = await fetch(`${apiBase()}/attempts/${startRes.data.attempt._id}/submit`, { method: 'POST', headers, body: '{}' });
  assert.equal(sub.status, 200);
  // can't withdraw after taking it
  assert.equal((await p.api('DELETE', `/quizzes/${quiz._id}/register`)).status, 400);

  // over: every member sees the leaderboard on the test's page
  const { Quiz } = await import('../src/models/Quiz.js');
  await Quiz.updateOne({ _id: quiz._id }, { startTime: new Date(Date.now() - 2 * 3600_000), endTime: new Date(Date.now() - 60_000) });
  const board = await stranger.api('GET', `/quizzes/${quiz._id}/details`);
  assert.equal(board.data.quiz.phase, 'ended');
  assert.equal(board.data.leaderboard.length, 1);
  assert.equal(board.data.leaderboard[0].user.name, 'Riya Kulkarni');
  assert.equal(board.data.leaderboard[0].score, 4);
  assert.equal(board.data.leaderboard[0].rank, 1);
  // registrations close with the test
  assert.equal((await stranger.api('POST', `/quizzes/${quiz._id}/register`, { name: 'Late Comer', college: 'BJMC' })).status, 400);
});

test('withdrawing a registration; private tests stay code-only and hidden from the details page', async () => {
  const org = await member({ quizHost: 'approved' });
  const p = await member();
  const quiz = await publish(org, { startTime: new Date(Date.now() + 60 * MIN).toISOString(), endTime: new Date(Date.now() + 120 * MIN).toISOString() });
  const reg = await p.api('POST', `/quizzes/${quiz._id}/register`, { name: 'Kabir Sen', college: 'KEM Mumbai' });
  await org.api('POST', `/quizzes/${quiz._id}/registrations`, { ids: [reg.data.registration._id], action: 'accept' });
  assert.equal((await p.api('GET', `/quizzes/${quiz._id}/info`)).data.eligibility.state, 'not_started');
  assert.equal((await p.api('DELETE', `/quizzes/${quiz._id}/register`)).status, 200);
  assert.equal((await p.api('GET', `/quizzes/${quiz._id}/info`)).status, 403);

  const priv = await publish(org, { settings: { listed: false } });
  assert.equal((await p.api('GET', `/quizzes/${priv._id}/details`)).status, 404);
  assert.equal((await p.api('POST', `/quizzes/${priv._id}/register`, { name: 'Kabir Sen', college: 'KEM' })).status, 404);
  const j = await p.api('POST', '/quizzes/join', { code: priv.accessCode });
  assert.equal(j.data.eligibility.state, 'ready');
});
