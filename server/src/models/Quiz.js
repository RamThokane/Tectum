import mongoose from 'mongoose';

/**
 * Tests ("quizzes") organised by approved hosts. Listed tests are taken by registering on the host's
 * profile; private ones by entering the access code.
 * The answer side of every question (correctAnswers, explanation) is select:false and is also
 * stripped by utils/quizSanitize.js before anything goes to a participant.
 */
export const QUESTION_TYPES = ['single', 'multiple', 'truefalse', 'short'];
export const QUIZ_DIFFICULTIES = ['easy', 'medium', 'hard'];
export const RESULT_VISIBILITY = ['immediate', 'after_end'];
export const MAX_QUESTIONS = 300;
const { ObjectId } = mongoose.Schema.Types;

// Texts may be empty in a draft; publishing checks that everything is filled in (checkQuizForPublish).
const optionSchema = new mongoose.Schema({ text: { type: String, trim: true, maxlength: 500, default: '' } });

const questionSchema = new mongoose.Schema({
  type: { type: String, enum: QUESTION_TYPES, required: true },
  text: { type: String, trim: true, maxlength: 4000, default: '' },
  image: { type: String, trim: true, maxlength: 1000, default: '' },
  options: { type: [optionSchema], default: [] }, // single / multiple / truefalse
  // single/multiple/truefalse: option ids; short: accepted answers (text, or numbers)
  correctAnswers: { type: [String], select: false, default: [] },
  // short answers that are numbers: accepted if within +/- this much of a correct number
  numericTolerance: { type: Number, min: 0, default: 0, select: false },
  marks: { type: Number, min: 0.25, max: 100, default: 1 },
  negativeMarks: { type: Number, min: 0, max: 100, default: 0 },
  explanation: { type: String, trim: true, maxlength: 4000, default: '', select: false },
  timeLimitSec: { type: Number, min: 0, max: 3600, default: 0 }, // 0 = no limit for this question
});

const settingsSchema = new mongoose.Schema(
  {
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: false },
    maxAttempts: { type: Number, min: 1, max: 5, default: 1 },
    passPercent: { type: Number, min: 0, max: 100, default: 40 },
    // multiple-correct questions: all-or-nothing, or a share of the marks for each right option
    partialMarking: { type: Boolean, default: false },
    // results (and answers) right after submitting, or only once the test window has closed
    resultVisibility: { type: String, enum: RESULT_VISIBILITY, default: 'after_end' },
    showAnswers: { type: Boolean, default: true },
    showLeaderboard: { type: Boolean, default: true },
    // 0 = strict: the first exit / tab switch disqualifies
    allowedFullscreenExits: { type: Number, min: 0, max: 2, default: 0 },
    allowedTabSwitches: { type: Number, min: 0, max: 2, default: 0 },
    maxParticipants: { type: Number, min: 0, max: 100000, default: 0 }, // 0 = no limit
    inviteOnly: { type: Boolean, default: false }, // the code works only for invited members
    desktopOnly: { type: Boolean, default: false },
    // Shown on the host's profile (Tests tab): members register, the host accepts them, and only
    // accepted members can take it. Off: private, for people with the code (older tests).
    listed: { type: Boolean, default: false },
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 150, required: true },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    instructions: { type: String, trim: true, maxlength: 6000, default: '' },
    category: { type: String, trim: true, maxlength: 60, default: '' },
    difficulty: { type: String, enum: [...QUIZ_DIFFICULTIES, ''], default: '' },
    organizer: { type: ObjectId, ref: 'User', required: true, index: true },
    questions: { type: [questionSchema], default: [] },
    // The window in which participants may START (stored in UTC).
    startTime: { type: Date },
    endTime: { type: Date },
    durationMinutes: { type: Number, min: 1, max: 600, default: 30 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    publishedAt: { type: Date },
    // Published after the host's free tests were used up: an upload charge applies (QuizHost.js).
    chargeable: { type: Boolean, default: false },
    accessCode: { type: String, unique: true, sparse: true }, // set on publish
    isJoinable: { type: Boolean, default: true },
    settings: { type: settingsSchema, default: () => ({}) },
    invitedUsers: { type: [{ type: ObjectId, ref: 'User' }], default: [] },
    // members who entered the code (needed before they can open the instructions and start)
    joinedUsers: { type: [{ type: ObjectId, ref: 'User' }], default: [] },
    totalMarks: { type: Number, default: 0 },
    // questions can't change once anyone has started an attempt
    attemptCount: { type: Number, default: 0 },
    // deleted by the organizer after people took it: hidden from them, kept for participants' results
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

quizSchema.index({ organizer: 1, deletedAt: 1, createdAt: -1 });
quizSchema.index({ organizer: 1, status: 1, 'settings.listed': 1, startTime: 1 }); // a host's Tests tab

/** Draft / Scheduled / Live / Ended, from the status and the window. */
export function quizPhase(quiz, now = new Date()) {
  if (quiz.status !== 'published') return 'draft';
  if (quiz.startTime && now < quiz.startTime) return 'scheduled';
  if (quiz.endTime && now > quiz.endTime) return 'ended';
  return 'live';
}

export const totalMarksOf = (questions = []) => Math.round(questions.reduce((n, q) => n + (Number(q.marks) || 0), 0) * 100) / 100;

export const Quiz = mongoose.model('Quiz', quizSchema);
