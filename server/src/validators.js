import { z } from 'zod';
import { ROLES, SIGNUP_ROLES, STUDY_YEARS, APP_SHORTCUT_STATUSES } from './models/User.js';
import { COURSE_VALUES, COUNTRY_CODES, courseFitsRole } from './data/courses.js';
import { POST_TYPES, POST_KINDS, REPLY_POLICIES, COLLAB_STATUSES, CASE_DIFFICULTIES } from './models/Post.js';
import { QUESTION_TYPES, QUIZ_DIFFICULTIES, RESULT_VISIBILITY, MAX_QUESTIONS } from './models/Quiz.js';
import { VIOLATION_TYPES } from './models/Attempt.js';
import { normalizeTag } from './utils/serializers.js';
import { USERNAME_RE, USERNAME_RULE, isReservedUsername } from './utils/username.js';

// ---------- helpers (multipart bodies arrive as strings) ----------
const parseJson = (v) => {
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (s === '') return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return v;
  }
};

const boolish = z.preprocess((v) => v === true || v === 'true' || v === '1' || v === 1, z.boolean());

const tagList = z
  .preprocess((v) => {
    if (v === undefined || v === null || v === '') return [];
    const parsed = parseJson(v);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'string') return parsed.split(',');
    return parsed;
  }, z.array(z.string().max(40)).max(12, 'At most 12 tags'))
  .transform((tags) => [...new Set(tags.map(normalizeTag).filter(Boolean))].map((t) => t.slice(0, 30)));

const optionalText = (max) => z.string().trim().max(max).optional().default('');

// ---------- limits ----------
export const MAX_POST_WORDS = 500; // Quick Post ("text") body
export const MAX_POST_WORDS_BLUE = 5000; // ...for blue tick members
const MAX_CONTENT_CHARS = 40000; // hard size cap; ~5000 words fits comfortably
export const countWords = (s = '') => (s.trim() ? s.trim().split(/\s+/).length : 0);

// ---------- auth ----------
/** Bump when the Terms/Privacy Policy change enough that members must accept again. Keep in sync with client/src/lib/legal.js. */
export const TERMS_VERSION = '2026-09-30';
const mustAcceptTerms = z
  .any()
  .refine((v) => v === true, 'Please confirm you are 18 or older and accept the Terms of Service and Privacy Policy');

const courseField = z.string({ error: 'Choose your course' }).trim().refine((v) => COURSE_VALUES.has(v), 'Choose your course from the list');
const countryField = z.string({ error: 'Choose your country' }).trim().toUpperCase().refine((v) => COUNTRY_CODES.has(v), 'Choose your country from the list');

/**
 * Account passwords (sign-up, reset, change / set): at least 8 characters with at least one
 * lowercase letter, one capital letter, one number and one symbol. Same rules as the web app's
 * checklist (client/src/lib/passwordRules.js). Logging in doesn't re-check, so older passwords still work.
 */
const strongPassword = (label) =>
  z
    .string()
    .min(8, `${label} must be at least 8 characters`)
    .max(72, `${label} must be at most 72 characters`)
    .regex(/[a-z]/, `${label} needs at least one small (lowercase) letter`)
    .regex(/[A-Z]/, `${label} needs at least one capital letter`)
    .regex(/[0-9]/, `${label} needs at least one number`)
    .regex(/[^A-Za-z0-9]/, `${label} needs at least one symbol, such as ! @ # $ %`);

// ---------- conducting tests ----------
/**
 * "I'll use Tectum to conduct quizzes": the application an admin reviews (sent at sign-up or later
 * from the Tests page). acceptTerms = the hosting terms (2 free tests, then a charge per test).
 */
export const hostApplicationSchema = z.object({
  orgName: z.string({ error: 'Enter your name or your organisation\'s name' }).trim().min(2, 'Enter your name or your organisation\'s name').max(120),
  about: z.string().trim().min(10, 'Tell us briefly what tests you will conduct, and for whom').max(1000),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => !v || /^[+\d][\d\s()-]{6,}$/.test(v), 'Enter a valid phone number')
    .optional()
    .default(''),
  website: z
    .string()
    .trim()
    .max(300)
    .refine((v) => !v || /^https?:\/\/\S+\.\S+/i.test(v), 'Enter the full web address, starting with https://')
    .optional()
    .default(''),
  acceptTerms: z.any().refine((v) => v === true, 'Please accept the terms for conducting tests'),
});

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: strongPassword('Password'),
  role: z.enum(SIGNUP_ROLES, { error: 'Choose Medical Student or Doctor' }),
  hostApplication: hostApplicationSchema.optional(),
  course: courseField,
  country: countryField,
  specialtyTags: tagList.optional().default([]),
  institution: optionalText(120),
  designation: optionalText(40),
  bio: optionalText(500),
  acceptTerms: mustAcceptTerms,
  // Proof from /auth/signup/verify-code that the member owns this email (checked in signup).
  emailProof: z.string().max(2000).optional(),
}).refine((b) => courseFitsRole(b.course, b.role), { path: ['course'], message: 'That course does not match the role you chose' });

export const sendEmailCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
});

export const verifyEmailCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from the email'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

// The Google button's one-time credential, plus the signup details for brand-new members.
export const googleAuthSchema = z.object({
  credential: z.string().min(20, 'Google sign-in failed, please try again').max(4096),
  name: z.string().trim().min(2, 'Name is too short').max(80).optional(),
  role: z.enum(SIGNUP_ROLES, { error: 'Choose Medical Student or Doctor' }).optional(),
  hostApplication: hostApplicationSchema.optional(),
  course: courseField.optional(),
  country: countryField.optional(),
  specialtyTags: tagList.optional(),
  institution: optionalText(120),
  designation: optionalText(40),
  bio: optionalText(500),
  acceptTerms: z.boolean().optional(), // required when this call creates the account (see googleAuth)
}).refine((b) => courseFitsRole(b.course, b.role), { path: ['course'], message: 'That course does not match the role you chose' });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
});

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'This reset link is invalid'),
  password: strongPassword('Password'),
});

export const switchAccountSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid account'),
});

// ---------- users ----------
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(ROLES).optional(),
  bio: z.string().trim().max(500).optional(),
  institution: z.string().trim().max(120).optional(),
  course: courseField.optional(),
  country: countryField.optional(),
  designation: z.string().trim().max(40, 'Designation can be at most 40 characters').optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .transform((u) => u.replace(/^@/, ''))
    .pipe(z.string().regex(USERNAME_RE, USERNAME_RULE).refine((u) => !isReservedUsername(u), 'That handle is reserved'))
    .optional(),
  yearLabel: z.string().trim().max(40, 'Year can be at most 40 characters').optional(),
  specialtyTags: tagList.optional(),
  // "true" clears the cover photo back to the default gradient.
  removeCover: z.enum(['true', 'false']).optional(),
});

// ---------- posts ----------
// Exact ages above 89 are identifying (HIPAA Safe Harbor), so they're stored as "90+".
const caseAge = z
  .string()
  .trim()
  .max(20, 'Age is too long')
  .transform((a) => (/^\d+$/.test(a) && Number(a) > 89 ? '90+' : a))
  .optional();

const caseStudyFields = z.object({
  age: caseAge,
  sex: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['male', 'female', 'other']).optional()),
  chiefComplaint: z.string().trim().min(3, 'Chief complaint is required').max(1000),
  history: optionalText(4000),
  examinationFindings: optionalText(4000),
  investigations: optionalText(4000),
  diagnosis: z.string().trim().min(2, 'Diagnosis is required').max(2000),
  learningPoint: optionalText(2000),
  mcqTips: optionalText(2000),
  difficulty: z.preprocess((v) => (v === '' ? undefined : v), z.enum(CASE_DIFFICULTIES).optional()),
  references: optionalText(2000),
  // Optional diagnosis poll: blanks are dropped; if any remain there must be 2-4 and a valid answer.
  pollOptions: z
    .array(z.string().trim().max(120))
    .max(4)
    .optional()
    .transform((a) => (a === undefined ? undefined : a.filter(Boolean))),
  correctOption: z.coerce.number().int().min(0).max(3).optional(),
}).superRefine((c, ctx) => {
  if (!c.pollOptions?.length) return;
  if (c.pollOptions.length < 2) ctx.addIssue({ code: 'custom', path: ['pollOptions'], message: 'A poll needs at least 2 options' });
  if (c.correctOption == null || c.correctOption >= c.pollOptions.length) {
    ctx.addIssue({ code: 'custom', path: ['correctOption'], message: 'Mark which poll option is the correct diagnosis' });
  }
});

const caseStudy = z.preprocess(parseJson, caseStudyFields);

export const createPostSchema = z.object({
  type: z.enum(POST_TYPES).default('text'),
  kind: z.enum(POST_KINDS).optional().default('discussion'),
  title: z.string().trim().max(200).optional().default(''),
  content: z.string().trim().max(MAX_CONTENT_CHARS).optional().default(''),
  caseStudy: caseStudy.optional(),
  tags: tagList.optional().default([]),
  isSensitiveContent: boolish.optional().default(false),
  deidentified: boolish.optional().default(false),
  // 'No patient-identifying information and I have consent' - required whenever images are attached.
  patientConsent: boolish.optional().default(false),
  replyPolicy: z.enum(REPLY_POLICIES).optional().default('everyone'),
  collab: z.enum(COLLAB_STATUSES).optional().default('none'),
  ownsRights: boolish.optional().default(false),
  quoteOf: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid post').optional(),
  quoteComment: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid comment').optional(),
});

export const updatePostSchema = z.object({
  replyPolicy: z.enum(REPLY_POLICIES).optional(),
  collab: z.enum(COLLAB_STATUSES).optional(),
  title: z.string().trim().max(200).optional(),
  content: z.string().trim().max(MAX_CONTENT_CHARS).optional(),
  caseStudy: caseStudy.optional(),
  tags: tagList.optional(),
  isSensitiveContent: boolish.optional(),
});

export const feedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).catch(1).default(1),
  limit: z.coerce.number().int().min(1).max(30).catch(10).default(10),
  following: boolish.optional().default(false),
  bookmarked: boolish.optional().default(false),
  q: z.string().trim().max(100).optional(), // search words (Community Search tab; in the Notebook it also looks in my private notes)
  specialty: z.string().trim().max(60).optional(),
  type: z.enum(POST_TYPES).optional().catch(undefined),
  tag: z.string().trim().max(40).optional(),
  author: z.string().trim().max(40).optional(),
  media: boolish.optional().default(false),
  reposts: boolish.optional().default(false),
  sort: z.enum(['ranked', 'recent', 'discussed', 'downloads']).optional().catch(undefined),
  // Case Rounds filters
  difficulty: z.enum(CASE_DIFFICULTIES).optional().catch(undefined),
  // Comma-separated tags where any one matches, e.g. the Wards of one MBBS year
  anyTag: z
    .string()
    .max(600)
    .optional()
    .transform((s) => (s ? s.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 40) : undefined)),
  // Comma-separated quick-post kinds, e.g. "question,discussion" (unknown ones are ignored).
  kinds: z
    .string()
    .max(80)
    .optional()
    .transform((s) => (s ? s.split(',').map((k) => k.trim()).filter((k) => POST_KINDS.includes(k)) : undefined)),
  wards: boolish.optional().default(false), // only posts in the Wards I joined
  grid: boolish.optional().default(false), // pearls and image posts, for the Pearl grid
  unsolved: boolish.optional().default(false), // cases I haven't worked through yet
  collab: boolish.optional().default(false), // only posts open for collaboration
});

export const notebookNoteSchema = z.object({
  text: z.string().trim().max(2000).optional().default(''),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(500).catch(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).catch(20).default(20),
});

export const commentSchema = z.object({
  text: z.string().trim().min(1, 'Comment cannot be empty').max(2000),
  parentId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid comment').optional(),
});

// First-login welcome steps (all optional so "Skip" works too).
export const onboardingSchema = z.object({
  skip: z.boolean().optional().default(false),
  role: z.enum(ROLES).optional(),
  studyYear: z.enum(STUDY_YEARS).optional(),
  designation: z.string().trim().max(40).optional(),
  interests: tagList.optional(),
  wards: z.array(z.string().trim().max(40)).max(40).optional(),
  dailyGoal: z.coerce.number().int().min(1).max(10).optional(),
});

// "Add Tectum to your home screen": the member's answer.
export const appShortcutSchema = z.object({ status: z.enum(APP_SHORTCUT_STATUSES) });

// Website: { reason: "free text" }. App: { reason: one of REPORT_REASONS, details }.
export const reportSchema = z.object({
  reason: z.string().trim().max(500).optional().default(''),
  details: z.string().trim().max(500).optional(),
});

export const searchSchema = z.object({
  q: z.string().trim().min(2, 'Search must be at least 2 characters').max(100),
});

// Type-ahead suggestions start from the first letter.
export const suggestSchema = z.object({
  q: z.string().trim().min(1).max(60),
});

// ---------- account settings ----------
const newPassword = strongPassword('New password');

// currentPassword is optional only for Google accounts that have no password yet (checked server-side).
export const changePasswordSchema = z
  .object({ currentPassword: z.string().optional().default(''), newPassword })
  .refine((d) => d.currentPassword !== d.newPassword, { message: 'New password must be different', path: ['newPassword'] });

export const changeEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password to confirm'),
});

// Accounts with a password confirm with it; Google-only accounts (no password) type DELETE / DEACTIVATE.
export const confirmPasswordSchema = z
  .object({
    password: z.string().optional(),
    confirm: z.string().trim().toUpperCase().optional(),
  })
  .refine((b) => b.password || b.confirm, { message: 'Enter your password to confirm', path: ['password'] });

export const preferencesSchema = z.object({
  notifications: z
    .object({
      like: z.boolean(),
      comment: z.boolean(),
      follow: z.boolean(),
      repost: z.boolean(),
      notes_saved: z.boolean(),
      mention: z.boolean(),
      reply: z.boolean(),
      quote: z.boolean(),
      message: z.boolean(),
    })
    .partial()
    .optional(),
  showSensitive: z.boolean().optional(),
  allowMentions: z.boolean().optional(),
});

export const verificationDecisionSchema = z.object({
  status: z.enum(['verified', 'unverified']),
});

// ---------- ads (admin) ----------
const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .url('Enter a full web address, starting with https://')
  .refine((u) => u.startsWith('https://'), 'The link must start with https://');
const optionalDate = z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), z.coerce.date().nullable());

export const adSchema = z.object({
  advertiser: z.string().trim().min(1, 'Who is the advertiser?').max(80),
  title: z.string().trim().min(3, 'Add a headline').max(80),
  body: z.string().trim().max(280).optional().default(''),
  linkUrl: httpsUrl,
  cta: z.string().trim().max(24).optional().default('Learn more'),
  placement: z.enum(['rail', 'feed', 'both']).optional().default('both'),
  active: boolish.optional().default(true),
  startsAt: optionalDate.optional(),
  endsAt: optionalDate.optional(),
});

export const adUpdateSchema = z.object({
  advertiser: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(3).max(80).optional(),
  body: z.string().trim().max(280).optional(),
  linkUrl: httpsUrl.optional(),
  cta: z.string().trim().max(24).optional(),
  placement: z.enum(['rail', 'feed', 'both']).optional(),
  active: boolish.optional(),
  startsAt: optionalDate.optional(),
  endsAt: optionalDate.optional(),
});

// ---------- encrypted chat ----------
const b64 = (max) => z.string().trim().min(1).max(max).regex(/^[A-Za-z0-9+/=_-]+$/, 'Invalid encoding');
export const chatKeySchema = z.object({
  keyId: z.string().trim().min(8).max(100),
  publicKey: z.string().trim().min(20).max(2000),
  encPrivateKey: b64(4000),
  salt: b64(100),
  iv: b64(100),
  iterations: z.coerce.number().int().min(100000).max(5000000),
});
export const chatMessageSchema = z.object({
  ciphertext: b64(20000),
  iv: b64(64),
  senderKeyId: z.string().trim().min(8).max(100),
  recipientKeyId: z.string().trim().min(8).max(100),
});
export const startConversationSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid member'),
});

// ---------- tests (quizzes) ----------
// Ids for new questions/options are made in the browser (24 hex characters, like database ids),
// so an answer key can point at an option before anything is saved.
const hexId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
// Drafts may be incomplete (checked fully on publish, see checkQuizForPublish).
const quizQuestionSchema = z.object({
  _id: hexId,
  type: z.enum(QUESTION_TYPES),
  text: z.string().trim().max(4000).optional().default(''),
  image: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => !v || /^https?:\/\//i.test(v) || v.startsWith('/uploads/'), 'The image must be a web link (https://…)')
    .optional()
    .default(''),
  options: z.array(z.object({ _id: hexId, text: z.string().trim().max(500).default('') })).max(6, 'At most 6 options').optional().default([]),
  correctAnswers: z.array(z.string().trim().max(200)).max(10).optional().default([]),
  numericTolerance: z.coerce.number().min(0).max(1e9).optional().default(0),
  marks: z.coerce.number().min(0.25, 'Marks must be more than 0').max(100),
  negativeMarks: z.coerce.number().min(0).max(100).optional().default(0),
  explanation: z.string().trim().max(4000).optional().default(''),
  timeLimitSec: z.coerce.number().int().min(0).max(3600).optional().default(0),
});
const quizSettingsSchema = z
  .object({
    shuffleQuestions: z.boolean(),
    shuffleOptions: z.boolean(),
    maxAttempts: z.coerce.number().int().min(1).max(5),
    passPercent: z.coerce.number().min(0).max(100),
    partialMarking: z.boolean(),
    resultVisibility: z.enum(RESULT_VISIBILITY),
    showAnswers: z.boolean(),
    showLeaderboard: z.boolean(),
    allowedFullscreenExits: z.coerce.number().int().min(0).max(2),
    allowedTabSwitches: z.coerce.number().int().min(0).max(2),
    maxParticipants: z.coerce.number().int().min(0).max(100000),
    inviteOnly: z.boolean(),
    desktopOnly: z.boolean(),
    listed: z.boolean(),
  })
  .partial();
const quizDate = z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.date().nullable());

export const quizSchema = z
  .object({
    title: z.string().trim().min(1, 'Give the test a title').max(150),
    description: optionalText(2000),
    instructions: optionalText(6000),
    category: optionalText(60),
    difficulty: z.enum([...QUIZ_DIFFICULTIES, '']).optional().default(''),
    startTime: quizDate.optional(),
    endTime: quizDate.optional(),
    durationMinutes: z.coerce.number().int().min(1, 'At least 1 minute').max(600, 'At most 10 hours').optional().default(30),
    questions: z.array(quizQuestionSchema).max(MAX_QUESTIONS, `At most ${MAX_QUESTIONS} questions`).optional().default([]),
    settings: quizSettingsSchema.optional().default({}),
  })
  .refine((q) => new Set(q.questions.map((x) => x._id)).size === q.questions.length, { message: 'Two questions have the same id', path: ['questions'] });

export const quizScheduleSchema = z.object({ startTime: quizDate, endTime: quizDate });

export const joinQuizSchema = z.object({ code: z.string().trim().min(1, 'Enter the access code').max(30) });

export const quizInviteSchema = z.object({ userIds: z.array(hexId).min(1, 'Choose at least one member').max(100, 'At most 100 at a time') });

export const quizImportSchema = z.object({
  format: z.enum(['csv', 'json']),
  content: z.string().max(500_000, 'That file is too big (500 KB at most)'),
});

export const quizAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: hexId,
        selected: z.array(z.string().max(200)).max(10).optional(),
        markedForReview: z.boolean().optional(),
        timeSpentSec: z.coerce.number().min(0).max(86400).optional(),
        seen: z.boolean().optional(), // first shown (starts a per-question timer)
      })
    )
    .min(1)
    .max(50),
});

export const quizViolationSchema = z.object({
  type: z.enum(VIOLATION_TYPES),
  meta: z.string().trim().max(300).optional().default(''),
});

/** Registering for a listed test: the details the host sees before accepting. */
export const quizRegistrationSchema = z.object({
  name: z.string({ error: 'Enter your name' }).trim().min(2, 'Enter your full name').max(80),
  college: z.string({ error: 'Enter your college' }).trim().min(2, 'Enter your college or institution').max(150),
});

export const registrationDecisionSchema = z.object({
  ids: z.array(hexId).min(1, 'Choose at least one request').max(500),
  action: z.enum(['accept', 'reject']),
});

export const hostDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(300).optional().default(''),
});

export const reinstateSchema = z.object({
  mode: z.enum(['count', 'retake']),
  note: z.string().trim().max(300).optional().default(''),
});

// ---------- academic portfolio ----------
const text = (max) => z.string().trim().max(max).optional().default('');
const ym = z.string().trim().regex(/^(\d{4}(-\d{2})?)?$/, 'Use a date like 2024-05').optional().default('');
// A web address (http/https), a DOI (10.xxxx/…) or a PubMed ID; nothing else, so no javascript: links.
const refLink = z
  .string()
  .trim()
  .max(500)
  .refine((v) => !v || /^https?:\/\//i.test(v) || /^10\.\d{4,9}\/\S+$/.test(v) || /^(pmid:?\s*)?\d{4,9}$/i.test(v), 'Enter a link (https://…), a DOI (10.…) or a PubMed ID')
  .optional()
  .default('');
const list = (item, label) => z.array(item).max(50, `At most 50 ${label}`);

export const portfolioSchema = z.object({
  publications: list(z.object({ title: z.string().trim().min(2, 'Add the paper title').max(300), journal: text(200), link: refLink, date: ym }), 'publications').optional(),
  electives: list(z.object({ institution: z.string().trim().min(2, 'Add the hospital or institution').max(200), department: text(120), role: text(120), from: ym, to: ym }), 'electives').optional(),
  presentations: list(
    z.object({ conference: z.string().trim().min(2, 'Add the conference name').max(200), type: z.enum(['poster', 'oral']).optional().default('poster'), title: text(300), location: text(160), year: ym }),
    'presentations'
  ).optional(),
  certifications: list(z.object({ name: z.string().trim().min(2, 'Add the certification name').max(160), issuer: text(160), validUntil: ym, link: refLink }), 'certifications').optional(),
});