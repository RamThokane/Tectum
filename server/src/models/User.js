import mongoose from 'mongoose';
import { uniqueUsername } from '../utils/username.js';

export const ROLES = ['student', 'doctor', 'nurse', 'researcher', 'other'];
export const STUDY_YEARS = ['1', '2', '3', 'final', 'intern', 'pg'];
export const VERIFICATION_STATUSES =['unverified', 'pending', 'verified'];
export const QUIZ_HOST_STATUSES = ['none', 'pending', 'approved', 'rejected'];
export const APP_SHORTCUT_STATUSES = ['later', 'installed'];
/** Roles offered at sign-up (older accounts may still have the others). */
export const SIGNUP_ROLES = ['student', 'doctor'];

const S = (max) => ({ type: String, trim: true, maxlength: max, default: '' });
/**
 * Academic portfolio shown on the profile and in the downloadable Medical CV. Dates are
 * "YYYY-MM" (or "YYYY") strings as picked in the form; links may be a URL, a DOI or a PubMed ID.
 */
const portfolioSchema = new mongoose.Schema(
  {
    publications: [{ title: S(300), journal: S(200), link: S(500), date: S(10) }],
    electives: [{ institution: S(200), department: S(120), role: S(120), from: S(10), to: S(10) }],
    presentations: [{ conference: S(200), type: { type: String, enum: ['poster', 'oral'], default: 'poster' }, title: S(300), location: S(160), year: S(10) }],
    certifications: [{ name: S(160), issuer: S(160), validUntil: S(10), link: S(500) }],
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // Public @handle (lowercase letters, numbers, dots, underscores). Made from the name when
    // missing (pre-save hook below); the member can change it in Settings.
    username: { type: String, trim: true, lowercase: true, maxlength: 30, index: { unique: true, sparse: true } },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Proved by the code emailed at sign-up (or by Google). Older accounts predate the check.
    emailVerified: { type: Boolean, default: false },
    // Not required for accounts created with Google: those have no password until one is set.
    password: { type: String, required: [function passwordRequired() { return !this.googleId; }, 'Password is required'], select: false },
    // Google account ("sub" claim) linked to this member, if they use "Continue with Google".
    googleId: { type: String, index: { unique: true, sparse: true } },
    // False for Google accounts until the member sets a password of their own.
    passwordSet: { type: Boolean, default: true },
    role: { type: String, enum: ROLES, default: 'student', required: true },
    // Students: MBBS year (matches the Wards' year filter); interns / PG after that.
    studyYear: { type: String, enum: STUDY_YEARS },
    // How a student describes their year, e.g. "MBBS 2nd Prof" or "NEET-PG 2027 aspirant" (shown instead of "Student").
    yearLabel: { type: String, trim: true, maxlength: 40, default: '' },
    // Course / degree (e.g. "mbbs", "bds", "md") and country (ISO code, e.g. "IN"), asked at sign-up.
    course: { type: String, trim: true, maxlength: 40, default: '' },
    country: { type: String, trim: true, uppercase: true, maxlength: 2, default: '' },
    // When the first-login welcome steps were finished (or skipped); unset = show them.
    onboardedAt: { type: Date },
    specialtyTags: { type: [String], default: [] },
    institution: { type: String, trim: true, maxlength: 120, default: '' },
    // Optional specialist title shown instead of the role badge, e.g. "Cardiologist" or "MD Medicine".
    designation: { type: String, trim: true, maxlength: 40, default: '' },
    bio: { type: String, trim: true, maxlength: 500, default: '' },
    portfolio: { type: portfolioSchema, default: () => ({}) },
    profilePicture: { type: String, default: '' },
    // Banner image shown behind the profile header and the home welcome banner.
    coverPhoto: { type: String, default: '' },
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'unverified' },
    // How the current verification was granted ('payment' only on old accounts from the removed paid blue tick).
    verifiedVia: { type: String, enum: ['admin', 'payment'] },
    verifiedAt: { type: Date },
    // Private reference to the uploaded document (never a public URL). Excluded from
    // queries by default; served only through an authenticated, owner/admin-only route.
    verificationDocumentUrl: { type: String, select: false },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Wards (specialty channels) the member joined, and when they last opened each one ("new" dots).
    wards: { type: [String], default: [] },
    // Posts the member marked "Not interested"; hidden from their feeds (latest 500 kept).
    notInterested: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }], default: [], select: false },
    wardVisits: { type: Map, of: Date, default: {} },
    // Private to the member: people whose posts they don't want in their feeds (they aren't told),
    // and people they've blocked (no follows, comments on their posts, messages or notifications).
    muted: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    blocked: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [], index: true },
    isAdmin: { type: Boolean, default: false },
    // Official Tectum account (e.g. "Tectum Team"): shows an "Official" badge instead of a role. Set by admins only.
    isOfficial: { type: Boolean, default: false },
    // Demo account made by scripts/seed-demo (never shown in the app; `--cleanup` removes them).
    isDemo: { type: Boolean, default: false, index: true, select: false },
    // Left over from the removed paid blue tick; the blue tick now simply means verified.
    isPremium: { type: Boolean, default: false },
    premiumSince: { type: Date },
    // Set while the account is deactivated (hidden everywhere). Logging in again clears it.
    deactivatedAt: { type: Date, default: null, index: true },
    // For the admin Members tab only: last log-in, and last request (updated at most every 5 minutes).
    lastLoginAt: { type: Date, select: false },
    lastActiveAt: { type: Date, select: false },
    // Bumped on password change / "log out everywhere" to invalidate existing JWTs.
    tokenVersion: { type: Number, default: 0 },
    // "Forgot password": SHA-256 of the emailed one-time token, and when it stops working.
    passwordResetHash: { type: String, select: false, index: { sparse: true } },
    passwordResetExpires: { type: Date, select: false },
    // Consent record: when the member accepted the Terms/Privacy Policy, and which version.
    acceptedTermsAt: { type: Date },
    termsVersion: { type: String },
    // Tests: how many times this member was disqualified (for admins to spot patterns), and whether a
    // site admin has blocked them from taking tests. Never set automatically unless
    // AUTO_BAN_ON_DISQUALIFICATION=true: one accidental Esc must not ban anyone.
    quizFlags: { type: Number, default: 0, select: false },
    quizBanned: { type: Boolean, default: false, select: false },
    // Conducting tests needs Tectum's approval: 'pending' while an application (QuizHostApplication)
    // waits for an admin, 'approved' once they may create and publish tests. Admins can always.
    quizHost: { type: String, enum: QUIZ_HOST_STATUSES, default: 'none', index: true },
    // "Add Tectum to your home screen": unset = not asked yet (Home shows the pop-up), 'later' = they
    // chose "Do it later" (their profile shows a red reminder), 'installed' = the shortcut was added
    // or the site was opened from it. Only the member sees it.
    appShortcut: { type: String, enum: APP_SHORTCUT_STATUSES },
    appShortcutAt: { type: Date },
    preferences: {
      notifications: {
        like: { type: Boolean, default: true },
        comment: { type: Boolean, default: true },
        follow: { type: Boolean, default: true },
        repost: { type: Boolean, default: true },
        notes_saved: { type: Boolean, default: true },
        mention: { type: Boolean, default: true },
        reply: { type: Boolean, default: true },
        quote: { type: Boolean, default: true },
        message: { type: Boolean, default: true },
      },
      // Show clinical images without the blur overlay.
      showSensitive: { type: Boolean, default: false },
      // Whether other members can @mention this person (off = not suggested, not linked, no alert).
      allowMentions: { type: Boolean, default: true },
      // Daily goal: how many cases to solve each day (the "Solve a case" goal's target).
      dailyGoal: { type: Number, min: 1, max: 10, default: 1 },
    },
  },
  { timestamps: true }
);

userSchema.index({ name: 'text', bio: 'text', institution: 'text', specialtyTags: 'text' });
userSchema.index({ wards: 1 }); // Ward member counts and faces
userSchema.index({ specialtyTags: 1 }); // suggestions, specialty filter
userSchema.index({ following: 1 }); // "accounts they follow" reply rules

// Every account gets an @handle: new ones at sign-up, older ones the next time they're saved
// (and all of them once at server start, see backfillUsernames).
userSchema.pre('save', async function assignUsername() {
  if (!this.username) this.username = await uniqueUsername(this.constructor, this.name);
});

userSchema.set('toJSON', {
  transform(_doc, ret) {
    // Lets the UI offer "Set a password" instead of "Change password" for Google-only accounts.
    ret.hasPassword = ret.passwordSet !== false;
    ret.usesGoogle = Boolean(ret.googleId);
    // Public: whether this account conducts tests (its profile gets a Tests tab). The raw status
    // ('pending', 'rejected'...) is shown only to the member themselves (see profileShape / me).
    ret.isQuizHost = ret.quizHost === 'approved';
    delete ret.password;
    delete ret.googleId;
    delete ret.passwordSet;
    delete ret.verificationDocumentUrl;
    delete ret.tokenVersion;
    delete ret.passwordResetHash;
    delete ret.passwordResetExpires;
    // Counts, not the full id lists (those could be thousands long and were sent on every page load).
    // Lists are fetched when needed: /users/:id/followers|following (paged), /users/me/following-ids.
    if (Array.isArray(ret.followers)) ret.followerCount = ret.followers.length;
    if (Array.isArray(ret.following)) ret.followingCount = ret.following.length;
    delete ret.followers;
    delete ret.following;
    // Never sent in API responses; profiles expose isMuted / isBlocked flags instead.
    delete ret.notInterested; // private, and only needed by the server's feed filter
    delete ret.lastActiveAt;
    delete ret.muted;
    delete ret.blocked;
    delete ret.wardVisits; // the Wards API sends "new since your last visit" counts instead
    delete ret.isDemo;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
