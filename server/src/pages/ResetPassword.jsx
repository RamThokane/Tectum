import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/ui';
import { PasswordInput } from '../components/ui';
import AuthShell, { FieldError } from './AuthShell';
import PasswordChecklist, { usePasswordChecked } from '../components/PasswordChecklist';
import { isStrongPassword, passwordProblem } from '../lib/passwordRules';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pwChecked, pwBlur, setPwChecked] = usePasswordChecked();
  const setSession = useAuthStore((s) => s.setSession);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setPwChecked(true);
    if (!isStrongPassword(form.password)) return setError(`Your password doesn't meet the rules yet. ${passwordProblem(form.password)}.`);
    if (form.password !== form.confirm) return setError("Passwords don't match");
    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', { token, password: form.password });
      qc.clear();
      setSession(data.user, data.token);
      toast('Password changed. You are now logged in.');
      navigate('/home', { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const footer = (
    <Link to="/forgot-password" className="font-medium text-link hover:underline">
      Request a new link
    </Link>
  );

  if (!token) {
    return (
      <AuthShell title="Reset link missing" subtitle="Open the link from your email again, or request a new one." footer={footer}>
        <Link to="/login" className="btn-secondary w-full py-2.5">Back to log in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="You'll be logged out on your other devices." footer={footer}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="new-password">New password</label>
          <PasswordInput id="new-password" autoComplete="new-password" value={form.password} onChange={(e) => { setForm({ ...form, password: e.target.value }); setError(''); }} onBlur={pwBlur} aria-describedby="reset-pw-rules" />
          <PasswordChecklist id="reset-pw-rules" password={form.password} checked={pwChecked} />
        </div>
        <div>
          <label className="label" htmlFor="confirm-password">Confirm new password</label>
          <PasswordInput id="confirm-password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </div>
        <FieldError>{error}</FieldError>
        <button className="btn-primary w-full py-2.5" disabled={loading || !isStrongPassword(form.password) || !form.confirm}>
          {loading ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </AuthShell>
  );
}
