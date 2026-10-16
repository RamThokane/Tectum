import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

export const env = {
  isProd,
  port: Number(process.env.PORT) || 5000,
  // RENDER_EXTERNAL_URL is set automatically on Render (the site's public https address).
  clientUrl: process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tectum',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  // Comma-separated emails that are made admins when they sign up or log in.
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30,
  authRateLimitWindowMin: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MIN) || 15,
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
};

// AI image review (Claude). Unset = review skipped; the poster's "sensitive" toggle applies.
env.anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

// "Continue with Google". Unset = the button is hidden and the route is off.
env.googleClientId = process.env.GOOGLE_CLIENT_ID || '';

// Outgoing email (password reset links, sign-up codes). Unset = printed in the server log (development only).
// BREVO_API_KEY (sent over HTTPS) wins over SMTP; MAIL_FROM is the sender address either way.
env.brevoApiKey = process.env.BREVO_API_KEY || '';
env.smtp = {
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT) || 465,
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.MAIL_FROM || process.env.SMTP_USER || '',
};
env.smtpEnabled = Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
env.emailEnabled = Boolean((env.brevoApiKey && env.smtp.from) || env.smtpEnabled);

// Tests: block a member from all tests automatically when they're disqualified. Off by default:
// accidental Esc presses are common, so only a site admin should suspend someone.
env.autoBanOnDisqualification = process.env.AUTO_BAN_ON_DISQUALIFICATION === 'true';

// How far ahead blue-tick (verified) members' posts rank in the feed.
env.premiumBoostHours = Number(process.env.PREMIUM_BOOST_HOURS) || 24;

env.cloudinaryEnabled = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);

if (isProd && !process.env.CLIENT_URL && !process.env.RENDER_EXTERNAL_URL) {
  throw new Error('CLIENT_URL must be set in production to the site\'s public address, e.g. https://example.com');
}
if (isProd && !process.env.MONGO_URI) {
  throw new Error('MONGO_URI must be set in production (e.g. your MongoDB Atlas connection string)');
}

if (!env.jwtSecret || env.jwtSecret.length < 16) {
  if (isProd) {
    throw new Error('JWT_SECRET must be set (16+ characters) in production');
  }
  // Dev-only fallback so the app boots out of the box. Sessions reset on restart.
  env.jwtSecret = 'dev-only-insecure-secret-' + Math.random().toString(36).slice(2);
  console.warn('[env] JWT_SECRET not set - using a temporary dev secret (sessions reset on restart).');
}
