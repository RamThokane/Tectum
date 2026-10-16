/**
 * Scoring and statistics for tests. Runs only on the server (the browser never sees the answer key
 * before results are released).
 *   single / true-false : full marks if right, minus negativeMarks if wrong, 0 if blank
 *   multiple            : all-or-nothing by default; with partialMarking, a share of the marks for
 *                         each right option chosen, but any wrong option chosen = minus negativeMarks
 *   short answer        : case- and space-insensitive match against any accepted answer; when the
 *                         accepted answers are numbers, a numeric answer within the tolerance counts
 */
const round2 = (n) => Math.round(n * 100) / 100;

export const normalizeText = (s) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const asNumber = (s) => {
  const t = String(s ?? '').trim().replace(/,/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** One question: { outcome, marks } for the participant's selection. */
export function scoreQuestion(q, selected = [], { partialMarking = false } = {}) {
  const chosen = (selected ?? []).map(String).filter((s) => s.trim() !== '');
  if (!chosen.length) return { outcome: 'unattempted', marks: 0 };
  const correct = (q.correctAnswers ?? []).map(String);
  const wrong = { outcome: 'wrong', marks: -(q.negativeMarks || 0) };

  if (q.type === 'short') {
    const given = chosen[0];
    const n = asNumber(given);
    const tol = Number(q.numericTolerance) || 0;
    const ok = correct.some((c) => {
      const cn = asNumber(c);
      if (n !== null && cn !== null) return Math.abs(n - cn) <= tol + 1e-9;
      return normalizeText(c) === normalizeText(given);
    });
    return ok ? { outcome: 'correct', marks: q.marks } : wrong;
  }

  if (q.type === 'multiple') {
    const want = new Set(correct);
    const picked = new Set(chosen);
    const anyWrong = [...picked].some((id) => !want.has(id));
    const rightPicked = [...picked].filter((id) => want.has(id)).length;
    if (!anyWrong && rightPicked === want.size) return { outcome: 'correct', marks: q.marks };
    if (anyWrong || !partialMarking) return wrong;
    return { outcome: 'partial', marks: round2((q.marks * rightPicked) / want.size) };
  }

  // single, truefalse
  return chosen[0] === correct[0] ? { outcome: 'correct', marks: q.marks } : wrong;
}

/** The whole attempt: totals and per-question results (in the quiz's own question order). */
export function scoreAttempt(quiz, attempt) {
  const byQ = new Map((attempt.answers ?? []).map((a) => [String(a.questionId), a]));
  const settings = quiz.settings ?? {};
  let score = 0;
  let negativeLost = 0;
  const counts = { correct: 0, wrong: 0, unattempted: 0 };
  const results = quiz.questions.map((q) => {
    const r = scoreQuestion(q, byQ.get(String(q._id))?.selected, settings);
    score += r.marks;
    if (r.marks < 0) negativeLost += -r.marks;
    if (r.outcome === 'correct' || r.outcome === 'partial') counts.correct += 1;
    else counts[r.outcome] += 1;
    return { questionId: String(q._id), outcome: r.outcome, marks: round2(r.marks) };
  });
  const maxScore = quiz.totalMarks || quiz.questions.reduce((n, q) => n + q.marks, 0);
  const percentage = maxScore ? round2((score / maxScore) * 100) : 0;
  return {
    score: round2(score),
    maxScore,
    percentage,
    passed: percentage >= (settings.passPercent ?? 0),
    correctCount: counts.correct,
    wrongCount: counts.wrong,
    unattemptedCount: counts.unattempted,
    negativeLost: round2(negativeLost),
    results,
  };
}

/**
 * Ranks for finished, counted attempts: one entry per member (their best attempt), by score (high
 * first) then time taken (fast first). Equal score AND time share a rank ("1, 2, 2, 4").
 */
export function rankAttempts(attempts) {
  const best = new Map();
  for (const a of attempts) {
    const k = String(a.user?._id ?? a.user);
    const cur = best.get(k);
    if (!cur || a.score > cur.score || (a.score === cur.score && a.timeTakenSec < cur.timeTakenSec)) best.set(k, a);
  }
  const list = [...best.values()].sort((a, b) => b.score - a.score || a.timeTakenSec - b.timeTakenSec);
  let rank = 0;
  list.forEach((a, i) => {
    const prev = list[i - 1];
    if (!prev || prev.score !== a.score || prev.timeTakenSec !== a.timeTakenSec) rank = i + 1;
    a.rank = rank;
  });
  return list;
}

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : round2((s[m - 1] + s[m]) / 2);
};

/** Organizer statistics over the ranked (best, non-disqualified) attempts of a test. */
export function quizStats(quiz, ranked, allFinished) {
  const scores = ranked.map((a) => a.score);
  const n = scores.length;
  const maxScore = quiz.totalMarks || 0;
  // 10 bands of percentage: 0-10, 10-20, ... 90-100 (negative scores count in the first band)
  const histogram = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: (i + 1) * 10, count: 0 }));
  for (const a of ranked) histogram[Math.min(9, Math.max(0, Math.floor((a.percentage ?? 0) / 10)))].count += 1;

  const perQuestion = quiz.questions.map((q, i) => {
    let correct = 0;
    let attempted = 0;
    let time = 0;
    let timed = 0;
    for (const a of allFinished) {
      const r = (a.results ?? []).find((x) => x.questionId === String(q._id));
      if (r && r.outcome !== 'unattempted') attempted += 1;
      if (r && r.outcome === 'correct') correct += 1;
      const ans = (a.answers ?? []).find((x) => x.questionId === String(q._id));
      if (ans?.timeSpentSec) {
        time += ans.timeSpentSec;
        timed += 1;
      }
    }
    const total = allFinished.length;
    return {
      questionId: String(q._id),
      number: i + 1,
      text: q.text.slice(0, 140),
      accuracy: total ? round2((correct / total) * 100) : 0,
      attempted,
      avgTimeSec: timed ? Math.round(time / timed) : 0,
    };
  });

  return {
    participants: n,
    average: n ? round2(scores.reduce((x, y) => x + y, 0) / n) : 0,
    highest: n ? Math.max(...scores) : 0,
    lowest: n ? Math.min(...scores) : 0,
    median: median(scores),
    passRate: n ? round2((ranked.filter((a) => a.passed).length / n) * 100) : 0,
    maxScore,
    histogram,
    perQuestion,
    disqualified: allFinished.filter((a) => a.status === 'disqualified').length,
  };
}
