import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/ui';
import { useSavedAccounts, useSwitchAccount } from '../hooks/useAccounts';
import Avatar from '../components/Avatar';
import { Tick } from '../components/VerificationBadge';
import { PasswordInput } from '../components/ui';
import GoogleButton, { AuthDivider, useGoogleClientId } from '../components/GoogleButton';
import AuthShell, { FieldError } from './AuthShell';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/home');

/** "Continue as ..." buttons for accounts remembered on this browser. */
function SavedAccounts() {
  const { data } = useSavedAccounts();
  const switchTo = useSwitchAccount();
  if (!data?.length) return null;
  return (
    <div className="mb-6">
      <p className="label">Continue as</p>
      <ul className="space-y-2">
        {data.map((a) => (
          <li key={a._id}>
            <button
              onClick={() => switchTo.mutate(a._id)}
              disabled={switchTo.isPending}
              className="flex w-full items-center gap-3 rounded-[12px] border border-line p-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              <Avatar user={a} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-[15px] font-semibold">{a.name} <Tick user={a} className="h-3.5 w-3.5" /></span>
                <span className="muted block truncate text-[12px]">{a.email}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-ds-fg-3" strokeWidth={1.5} />
            </button>
          </li>
        ))}
      </ul>
      <div className="my-5 flex items-center gap-3 text-[12px] text-ds-fg-3">
        <span className="h-px flex-1 bg-line" /> or log in to another account
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

export default function Login() {
  useDocumentTitle('Log in');
  const [params] = useSearchParams();
  // The landing page's email box hands the address over as ?email=
  const [form, setForm] = useState(() => ({ email: params.get('email') || '', password: '' }));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const status = useAuthStore((s) => s.status);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const adding = params.get('add') === '1' && status === 'authenticated';
  const googleClientId = useGoogleClientId();

  // "Continue with Google". Google accounts we've never seen go to signup to pick a role first.
  const withGoogle = async (credential) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/google', { credential });
      if (data.newUser) {
        navigate('/signup', { replace: true, state: { google: { credential, ...data.profile } } });
        return;
      }
      qc.clear();
      setSession(data.user, data.token);
      if (data.reactivated) toast('Welcome back! Your account is active again.');
      else if (adding) toast(`Added ${data.user.name}. You're now using this account.`);
      navigate(adding ? '/home' : safeNext(params.get('next')), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      qc.clear(); // don't carry cached data between accounts
      setSession(data.user, data.token);
      if (data.reactivated) toast('Welcome back! Your account is active again.');
      else if (adding) toast(`Added ${data.user.name}. You're now using this account.`);
      navigate(adding ? '/home' : safeNext(params.get('next')), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={adding ? 'Add another account' : 'Welcome back'}
      subtitle={adding ? "Log in to another Tectum account. You'll be able to switch between them." : 'Log in to continue to Tectum.'}
      footer={
        adding ? (
          <Link to="/settings?section=accounts" className="font-medium text-link hover:underline">
            Cancel
          </Link>
        ) : (
          <>
            New here?{' '}
            <Link to="/signup" className="font-medium text-link hover:underline">
              Create an account
            </Link>
          </>
        )
      }
    >
      {!adding && <SavedAccounts />}
      {googleClientId && (
        <>
          <GoogleButton onCredential={withGoogle} disabled={loading} oneTap context="signin" />
          <AuthDivider>or use your email</AuthDivider>
        </>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <div className="mt-1.5 text-right">
            <Link
              to={`/forgot-password${form.email ? `?email=${encodeURIComponent(form.email)}` : ''}`}
              className="text-[13px] font-medium text-link hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>
        <FieldError>{error}</FieldError>
        <button className="btn-primary w-full py-2.5" disabled={loading || !form.email || !form.password}>
          {loading ? 'Logging in…' : adding ? 'Add account' : 'Log in'}
        </button>
      </form>
    </AuthShell>
  );
}
