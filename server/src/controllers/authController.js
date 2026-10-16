import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { EmailCode } from '../models/EmailCode.js';
import { sendMail } from '../utils/mailer.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import {
  clearAuthCookie,
  setAuthCookie,
  verifyToken,
  isTokenCurrent,
  readSavedTokens,
  writeSavedTokens,
  withoutAccount,
  startSession,
  ACCOUNTS_COOKIE,
} from '../utils/token.js';
import { extractToken } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { TERMS_VERSION } from '../validators.js';
import { invalidateHiddenUsers } from '../utils/visibility.js';
import { submitHostApplication } from './quizHostController.js';

export const BCRYPT_ROUNDS = 12;
// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('tectum-dummy-password', BCRYPT_ROUNDS);

const isConfiguredAdmin = (email) => env.adminEmails.includes(email);
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Records the log-in time for the admin Members tab (never fails the log-in). */
const markLogin = (user) => {
  const now = new Date();
  return User.updateOne({ _id: user._id }, { lastLoginAt: now, lastActiveAt: now }).catch(() => {});
};

const respondWithSession = (req, res, user, status = 200) => {
  markLogin(user);
  // Also remembers the account in this browser's saved-accounts list (for switching).
  const token = startSession(res, user, req);
  res.status(status).json({ user: user.toJSON(), token });
};

// ---------------- email check at sign-up ----------------
// A 6-digit code is emailed; entering it returns a signed "proof" that the sign-up must carry.
// Production without SMTP can't send codes, so the check is skipped there (with a warning)
// rather than blocking every new sign-up. Development prints the code in the server log.
const CODE_TTL_MIN = 10;
const CODE_RESEND_SEC = 45;
const CODE_MAX_TRIES = 5;
export const emailCheckOn = () => env.emailEnabled || !env.isProd;
const hashCode = (email, code) => crypto.createHash('sha256').update(`${email}:${code}`).digest('hex');
const proofSecret = () => `${env.jwtSecret}:signup-email`; // never accepted as a session token

export const signEmailProof = (email) => jwt.sign({ email, purpose: 'signup-email' }, proofSecret(), { expiresIn: '2h' });
const proofEmail = (proof) => {
  try {
    const p = jwt.verify(proof, proofSecret());
    return p.purpose === 'signup-email' ? p.email : null;
  } catch {
    return null;
  }
};

/** Emails a sign-up code to the address typed in. */
export const sendEmailCode = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists. Please log in instead.');
  if (!emailCheckOn()) {
    console.warn('[email] SMTP not configured - sign-up email check skipped');
    return res.json({ required: false });
  }

  const recent = await EmailCode.findOne({ email }).select('updatedAt');
  if (recent && Date.now() - recent.updatedAt.getTime() < CODE_RESEND_SEC * 1000) {
    throw ApiError.badRequest(`We just sent a code. Please wait ${CODE_RESEND_SEC} seconds before asking for another.`);
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await EmailCode.findOneAndUpdate(
    { email },
    { codeHash: hashCode(email, code), attempts: 0, expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60 * 1000) },
    { upsert: true }
  );
  try {
    await sendMail({
      to: email,
      subject: `${code} is your Tectum code`,
      text: `Your Tectum sign-up code is ${code}\n\nIt expires in ${CODE_TTL_MIN} minutes. If you didn't try to join Tectum, you can ignore this email.`,
      html: `<p>Your Tectum sign-up code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:12px 0">${code}</p><p style="color:#64748b;font-size:13px">It expires in ${CODE_TTL_MIN} minutes. If you didn't try to join Tectum, you can ignore this email.</p>`,
    });
  } catch (err) {
    console.error('[email] sign-up code failed:', err.message);
    await EmailCode.deleteOne({ email });
    throw new ApiError(502, "We couldn't send the email. Please check the address and try again.");
  }
  res.json({ required: true, message: `We sent a 6-digit code to ${email}` });
});

/** Checks the emailed code; returns the proof the sign-up needs. */
export const verifyEmailCode = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const entry = await EmailCode.findOne({ email });
  if (!entry || entry.expiresAt < new Date() || entry.attempts >= CODE_MAX_TRIES) {
    throw ApiError.badRequest('This code has expired. Please tap "Send a new code".');
  }
  if (entry.codeHash !== hashCode(email, code)) {
    entry.attempts += 1;
    await entry.save();
    const left = CODE_MAX_TRIES - entry.attempts;
    throw ApiError.badRequest(left > 0 ? `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Please tap "Send a new code".');
  }
  await EmailCode.deleteOne({ email });
  res.json({ emailProof: signEmailProof(email) });
});

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password, role, course, country, specialtyTags, institution, designation, bio, emailProof } = req.body;

  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');
  const emailVerified = Boolean(emailProof) && proofEmail(emailProof) === email;
  if (emailCheckOn() && !emailVerified) throw ApiError.badRequest('Please verify your email first');

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({
    name,
    email,
    emailVerified,
    password: hashed,
    role,
    course,
    country,
    specialtyTags,
    institution,
    designation: role === 'doctor' ? designation : '', // specialist titles are for doctors
    bio,
    isAdmin: isConfiguredAdmin(email),
    acceptedTermsAt: new Date(),
    termsVersion: TERMS_VERSION,
  });
  // "I'll use Tectum to conduct quizzes": the application waits for an admin.
  if (req.body.hostApplication) await submitHostApplication(user, req.body.hostApplication);
  respondWithSession(req, res, user, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  const ok = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !ok) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isAdmin && isConfiguredAdmin(user.email)) user.isAdmin = true;
  // Logging in to a deactivated account reactivates it.
  const reactivated = Boolean(user.deactivatedAt);
  if (reactivated) user.deactivatedAt = null;
  if (user.isModified()) await user.save();
  if (reactivated) invalidateHiddenUsers();
  markLogin(user);

  // Also remembers the account in this browser's saved-accounts list (for switching).
  const token = startSession(res, user, req);
  res.json({ user: user.toJSON(), token, reactivated });
});

// ---------------- continue with Google ----------------
const googleClient = env.googleClientId ? new OAuth2Client(env.googleClientId) : null;

/** Checks the one-time credential the Google button hands us and returns the verified profile. */
async function verifyGoogleCredential(credential) {
  if (!googleClient) throw ApiError.badRequest('Google sign-in is not set up on this server');
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw ApiError.unauthorized('Could not verify that Google sign-in. Please try again.');
  }
  if (!payload?.email || !payload.email_verified) {
    throw ApiError.badRequest('Your Google account has no verified email address.');
  }
  return { googleId: payload.sub, email: payload.email.toLowerCase(), name: payload.name?.trim() || payload.email.split('@')[0], picture: payload.picture || '' };
}

/**
 * One route for both "log in with Google" and "sign up with Google".
 * Unknown Google accounts are NOT created here: we return the profile so the signup steps
 * (role, specialties) can be filled in first, then this is called again with those details.
 */
export const googleAuth = asyncHandler(async (req, res) => {
  const profile = await verifyGoogleCredential(req.body.credential);
  let user = await User.findOne({ $or: [{ googleId: profile.googleId }, { email: profile.email }] });

  if (!user) {
    if (!req.body.role) {
      return res.json({ newUser: true, profile: { name: profile.name, email: profile.email, picture: profile.picture } });
    }
    if (req.body.acceptTerms !== true) {
      throw ApiError.badRequest('Please confirm you are 18 or older and accept the Terms of Service and Privacy Policy');
    }
    if (!req.body.course || !req.body.country) throw ApiError.badRequest('Please choose your course and country');
    user = await User.create({
      acceptedTermsAt: new Date(),
      termsVersion: TERMS_VERSION,
      name: req.body.name?.trim() || profile.name,
      email: profile.email,
      emailVerified: true, // Google has already checked it
      googleId: profile.googleId,
      passwordSet: false,
      profilePicture: profile.picture,
      role: req.body.role,
      course: req.body.course ?? '',
      country: req.body.country ?? '',
      specialtyTags: req.body.specialtyTags ?? [],
      institution: req.body.institution ?? '',
      designation: req.body.role === 'doctor' ? req.body.designation ?? '' : '',
      bio: req.body.bio ?? '',
      isAdmin: isConfiguredAdmin(profile.email),
    });
    if (req.body.hostApplication) await submitHostApplication(user, req.body.hostApplication);
    return respondWithSession(req, res, user, 201);
  }

  // Existing member: link the Google account to it the first time (same verified email).
  if (!user.googleId) user.googleId = profile.googleId;
  if (!user.emailVerified) user.emailVerified = true;
  if (!user.profilePicture && profile.picture) user.profilePicture = profile.picture;
  if (!user.isAdmin && isConfiguredAdmin(user.email)) user.isAdmin = true;
  const reactivated = Boolean(user.deactivatedAt);
  if (reactivated) user.deactivatedAt = null;
  if (user.isModified()) await user.save();
  if (reactivated) invalidateHiddenUsers();
  markLogin(user);

  const token = startSession(res, user, req);
  res.json({ user: user.toJSON(), token, reactivated });
});

// ---------------- forgot password ----------------
const RESET_TTL_MIN = 30;
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Emails a one-time reset link. Always answers the same way so it can't be used to probe which emails exist. */
export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetHash = hashResetToken(token);
    user.passwordResetExpires = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000);
    await user.save();

    const link = `${env.clientUrl}/reset-password?token=${token}`;
    try {
      await sendMail({
        to: user.email,
        subject: 'Reset your Tectum password',
        text: `Hi ${user.name},\n\nUse this link to choose a new Tectum password (it works once and expires in ${RESET_TTL_MIN} minutes):\n${link}\n\nIf you didn't ask for this, you can ignore this email - your password won't change.`,
        html: `<p>Hi ${escapeHtml(user.name)},</p><p>Use the button below to choose a new Tectum password. It works once and expires in ${RESET_TTL_MIN} minutes.</p><p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p><p style="color:#64748b;font-size:13px">If you didn't ask for this, you can ignore this email - your password won't change.</p>`,
      });
    } catch (err) {
      console.error('[email] reset email failed:', err.message);
    }
  }
  res.json({ message: `If an account exists for that email, a reset link is on its way. It expires in ${RESET_TTL_MIN} minutes.` });
});

/** Sets a new password from an emailed link, signs out every other device and logs this browser in. */
export const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    passwordResetHash: hashResetToken(req.body.token),
    passwordResetExpires: { $gt: new Date() },
  });
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired. Please request a new one.');

  user.password = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS);
  user.passwordSet = true;
  user.emailVerified = true; // the emailed link reached them
  user.passwordResetHash = undefined;
  user.passwordResetExpires = undefined;
  user.tokenVersion += 1;
  const wasDeactivated = Boolean(user.deactivatedAt);
  user.deactivatedAt = null;
  if (!user.isAdmin && isConfiguredAdmin(user.email)) user.isAdmin = true;
  await user.save();
  if (wasDeactivated) invalidateHiddenUsers();
  respondWithSession(req, res, user);
});

// ---------------- multiple accounts ----------------
const ACCOUNT_FIELDS = 'name email role profilePicture verificationStatus isPremium deactivatedAt tokenVersion isAdmin +isDemo';

/** Saved accounts that are still valid (token not expired/revoked, account active). Drops the rest. */
async function loadSavedAccounts(req, res) {
  const valid = [];
  for (const token of readSavedTokens(req)) {
    try {
      const payload = verifyToken(token);
      const user = await User.findById(payload.id).select(ACCOUNT_FIELDS);
      if (user && !user.deactivatedAt && isTokenCurrent(payload, user) && !valid.some((v) => v.user.equals(user._id))) {
        valid.push({ token, user });
      }
    } catch {
      /* expired or tampered token: forget it */
    }
  }
  const before = readSavedTokens(req);
  if (valid.length !== before.length) writeSavedTokens(res, valid.map((v) => v.token));
  return valid;
}

const publicAccount = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  profilePicture: u.profilePicture,
  verificationStatus: u.verificationStatus,
  isPremium: u.isPremium,
  // Only this browser's own saved sessions are listed, so these flags reveal nothing to others.
  isAdmin: Boolean(u.isAdmin),
  isDemo: Boolean(u.isDemo),
});

/** Accounts remembered in this browser (works logged out too, for "Continue as ..."). */
export const listAccounts = asyncHandler(async (req, res) => {
  const accounts = await loadSavedAccounts(req, res);
  let currentId = null;
  try {
    const t = extractToken(req);
    if (t) {
      const payload = verifyToken(t);
      currentId = String(payload.id);
      // Sessions started before multi-account existed aren't in the saved list yet: add them.
      if (!accounts.some((a) => String(a.user._id) === currentId)) {
        const user = await User.findById(payload.id).select(ACCOUNT_FIELDS);
        if (user && !user.deactivatedAt && isTokenCurrent(payload, user)) {
          accounts.unshift({ token: t, user });
          writeSavedTokens(res, accounts.map((a) => a.token));
        }
      }
    }
  } catch {
    /* no current session */
  }
  res.json({
    accounts: accounts.map(({ user }) => ({ ...publicAccount(user), current: String(user._id) === currentId })),
  });
});

export const switchAccount = asyncHandler(async (req, res) => {
  const accounts = await loadSavedAccounts(req, res);
  const target = accounts.find((a) => String(a.user._id) === String(req.body.userId));
  if (!target) throw ApiError.notFound('That account is not saved in this browser. Please log in to it.');
  setAuthCookie(res, target.token);
  const user = await User.findById(target.user._id);
  res.json({ user: user.toJSON(), token: target.token });
});

export const forgetAccount = asyncHandler(async (req, res) => {
  try {
    const t = extractToken(req);
    if (t && String(verifyToken(t).id) === String(req.params.userId)) {
      throw ApiError.badRequest("That's the account you're using now. Use \"Log out\" instead.");
    }
  } catch (err) {
    if (err instanceof ApiError) throw err; // an invalid current token just means "not logged in"
  }
  writeSavedTokens(res, withoutAccount(readSavedTokens(req), req.params.userId));
  res.json({ message: 'Account removed from this browser' });
});

/**
 * Logs out of the current account and forgets it on this browser. If other accounts are saved,
 * the browser switches to the next one (like most social apps).
 */
export const logout = asyncHandler(async (req, res) => {
  let currentId = null;
  try {
    const t = extractToken(req);
    if (t) currentId = verifyToken(t).id;
  } catch {
    /* already logged out */
  }
  const remaining = currentId ? withoutAccount(readSavedTokens(req), currentId) : readSavedTokens(req);
  writeSavedTokens(res, remaining);

  const next = (await loadSavedAccounts({ cookies: { [ACCOUNTS_COOKIE]: remaining } }, res))[0];
  if (next) {
    setAuthCookie(res, next.token);
    const user = await User.findById(next.user._id);
    return res.json({ message: 'Logged out', switchedTo: user.toJSON(), token: next.token });
  }
  clearAuthCookie(res);
  res.json({ message: 'Logged out' });
});

export const logoutAll = (_req, res) => {
  clearAuthCookie(res);
  writeSavedTokens(res, []);
  res.json({ message: 'Logged out of all accounts' });
};

export const me = (req, res) => {
  // isDemo only ever reaches the demo account's own session (an admin using it), for the "Switch back" bar.
  res.json({ user: { ...req.user.toJSON(), ...(req.user.isDemo ? { isDemo: true } : {}) } });
};
