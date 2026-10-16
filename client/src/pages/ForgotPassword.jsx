import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { api } from '../api/client';
import AuthShell, { FieldError } from './AuthShell';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function ForgotPassword() {
  useDocumentTitle('Forgot password');
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setSent(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot password?"
      subtitle={sent ? undefined : "Enter your account's email and we'll send you a link to choose a new password."}
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-link hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="flex gap-3 rounded-[12px] bg-success-soft p-4 text-[13px] leading-[18px] text-success">
          <MailCheck className="h-5 w-5 shrink-0" />
          <div>
            <p>{sent}</p>
            <p className="mt-1 opacity-80">Check your spam folder if it doesn't arrive in a few minutes.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <FieldError>{error}</FieldError>
          <button className="btn-primary w-full py-2.5" disabled={loading || !email}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
