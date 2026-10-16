import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// Brevo's web API is preferred: hosts like Render's free plan block SMTP ports, but not HTTPS.
const transport =
  !env.brevoApiKey && env.smtpEnabled
    ? nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: { user: env.smtp.user, pass: env.smtp.pass },
        // Fail in seconds (not the 2-minute default) when the mail server can't be reached.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      })
    : null;

if (!env.emailEnabled) {
  console.warn('[email] email not configured - password reset links and sign-up codes are printed here instead of emailed');
}

async function sendWithBrevo({ to, subject, text, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.brevoApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'Tectum', email: env.smtp.from }, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** Sends an email. Without email settings, development prints it to the log; production just warns. */
export async function sendMail({ to, subject, text, html }) {
  if (env.brevoApiKey) return sendWithBrevo({ to, subject, text, html });
  if (transport) {
    await transport.sendMail({ from: `Tectum <${env.smtp.from}>`, to, subject, text, html });
    return;
  }
  if (env.isProd) {
    console.warn(`[email] not sent to ${to} (email not configured): ${subject}`);
  } else {
    console.log(`\n[email] To: ${to}\n[email] Subject: ${subject}\n${text}\n`);
  }
}
