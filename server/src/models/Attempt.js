import mongoose from 'mongoose';

/**
 * One member's attempt at a test. The server is the source of truth for time (expiresAt), for
 * the attempt's status and for the score. Violations (full-screen exits, tab switches...) are
 * reported by the browser, logged here with a timestamp, and the server decides what they mean.
 */
export const ATTEMPT_STATUSES = ['in_progress', 'submitted', 'auto_submitted', 'disqualified', 'voided'];
export const VIOLATION_TYPES = [
  'FULLSCREEN_EXIT', // left full screen (Esc, F11, refresh)
  'TAB_SWITCH', // the page was hidden (other tab, minimised)
  'WINDOW_BLUR', // another app / window took focus
  'SESSION_LOST', // the test page was closed or crashed and reopened
  'MULTIPLE_SESSION', // the attempt was opened in a second tab or device (blocked)
  'SHORTCUT_BLOCKED', // copy, paste, print, devtools... shortcut pressed (blocked)
  'CONTEXT_MENU',
  'COPY_PASTE',
  'DEVTOOLS', // best-effort detection only
  'FULLSCREEN_UNSUPPORTED',
];
const { ObjectId } = mongoose.Schema.Types;

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    selected: { type: [String], default: [] }, // option ids, or [text] for short answers
    timeSpentSec: { type: Number, default: 0, min: 0 },
    firstSeenAt: { type: Date }, // per-question time limits run from here
    answeredAt: { type: Date },
    markedForReview: { type: Boolean, default: false },
  },
  { _id: false }
);

const violationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: VIOLATION_TYPES, required: true },
    at: { type: Date, default: Date.now },
    userAgent: { type: String, maxlength: 300 },
    meta: { type: String, maxlength: 300 },
    counted: { type: Boolean, default: false }, // counted toward disqualification
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    quiz: { type: ObjectId, ref: 'Quiz', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ATTEMPT_STATUSES, default: 'in_progress', index: true },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    submittedAt: { type: Date },
    sessionToken: { type: String, select: false },
    lastSeenAt: { type: Date }, // heartbeat: tells a closed/crashed page from a second open tab
    questionOrder: { type: [String], default: [] },
    optionOrder: { type: Map, of: [String], default: {} },
    answers: { type: [answerSchema], default: [] },
    violations: { type: [violationSchema], default: [] },
    fullscreenExits: { type: Number, default: 0 },
    tabSwitches: { type: Number, default: 0 },
    // scoring (set on submit / auto-submit / disqualification)
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    unattemptedCount: { type: Number, default: 0 },
    negativeLost: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    timeTakenSec: { type: Number, default: 0 },
    // per question: right / wrong / unanswered and the marks it got (for stats and review)
    results: {
      type: [{ questionId: String, outcome: { type: String, enum: ['correct', 'partial', 'wrong', 'unattempted'] }, marks: Number, _id: false }],
      default: [],
    },
    rank: { type: Number },
    disqualifiedAt: { type: Date },
    disqualifiedReason: { type: String, maxlength: 300 },
    // the organizer lifted a disqualification ("count" = scored normally, "retake" = attempt voided)
    reinstatedBy: { type: ObjectId, ref: 'User' },
    reinstatedAt: { type: Date },
    reinstateNote: { type: String, maxlength: 300 },
    ip: { type: String, maxlength: 64 },
    userAgent: { type: String, maxlength: 300 },
    // 'phone' = iPhone mode: iPhones have no full screen for web pages, so the test ran without it
    // and leaving the page (app / tab switch, home screen) was what counted. Shown to the organizer.
    mode: { type: String, enum: ['fullscreen', 'phone'], default: 'fullscreen' },
  },
  { timestamps: true }
);

// One row per (test, member, attempt number): two clicks on Start can't make two attempts.
attemptSchema.index({ quiz: 1, user: 1, attemptNumber: 1 }, { unique: true });
attemptSchema.index({ quiz: 1, user: 1 });
attemptSchema.index({ quiz: 1, score: -1 });
attemptSchema.index({ status: 1, expiresAt: 1 }); // the auto-submit sweep
attemptSchema.index({ user: 1, createdAt: -1 }); // My attempts

export const FINISHED = ['submitted', 'auto_submitted', 'disqualified'];
export const RANKED = ['submitted', 'auto_submitted'];

export const Attempt = mongoose.model('Attempt', attemptSchema);
