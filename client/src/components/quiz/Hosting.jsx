import { useState } from 'react';
import { Building2, Info } from 'lucide-react';
import { Modal } from '../ui';
import { useApplyToHost } from '../../hooks/useQuiz';
import { useAuthStore } from '../../store/auth';
import { toast } from '../../store/ui';

/** Tests: conducting them needs Tectum's approval (admins can always). */
export const FREE_HOSTED_TESTS = 2;
export const canHostTests = (user) => Boolean(user?.isAdmin || user?.quizHost === 'approved');

export const blankApplication = (user) => ({ orgName: user?.name ?? '', about: '', phone: '', website: '', acceptTerms: false });

/** Client-side check of an application (the server checks the same). Returns { field: message }. */
export function applicationErrors(a) {
  const e = {};
  if (a.orgName.trim().length < 2) e.orgName = "Enter your name or your organisation's name";
  if (a.about.trim().length < 10) e.about = 'Tell us briefly what tests you will conduct, and for whom';
  if (a.phone.trim() && !/^[+\d][\d\s()-]{6,}$/.test(a.phone.trim())) e.phone = 'Enter a valid phone number';
  if (a.website.trim() && !/^https?:\/\/\S+\.\S+/i.test(a.website.trim())) e.website = 'Enter the full web address, starting with https://';
  if (!a.acceptTerms) e.acceptTerms = 'Please accept the terms for conducting tests';
  return e;
}

/** The plan in one sentence, as agreed in the application. */
export function HostTermsNotice({ className = '' }) {
  return (
    <p className={`flex gap-2 rounded-[12px] bg-ds-brand-soft px-4 py-3 text-[14px] leading-5 text-ink ${className}`} role="note">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-ds-brand-text" />
      <span>
        <strong className="font-semibold">Your first {FREE_HOSTED_TESTS} quizzes are free to conduct.</strong> Beyond that, a minimal upload charge will apply per quiz. Tectum reviews every
        application before quiz hosting is switched on.
      </span>
    </p>
  );
}

const Err = ({ children }) => (children ? <p className="mt-1 text-[13px] text-danger" role="alert">{children}</p> : null);

/** Organisation, what they'll run, contact, and the terms checkbox. Used at sign-up and in the apply dialog. */
export function HostApplicationFields({ value, onChange, errors = {}, idPrefix = 'host' }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor={`${idPrefix}-org`}>Organisation or host name</label>
        <input id={`${idPrefix}-org`} className="input" maxLength={120} value={value.orgName} onChange={(e) => set({ orgName: e.target.value })} placeholder="e.g. BrainRx, or your own name" aria-invalid={Boolean(errors.orgName)} />
        <Err>{errors.orgName}</Err>
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}-about`}>What tests will you conduct, and for whom?</label>
        <textarea id={`${idPrefix}-about`} className="input" rows={3} maxLength={1000} value={value.about} onChange={(e) => set({ about: e.target.value })} placeholder="e.g. Weekly NEET-PG grand tests for final-year MBBS students" aria-invalid={Boolean(errors.about)} />
        <Err>{errors.about}</Err>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${idPrefix}-phone`}>Contact number <span className="muted font-normal">(optional)</span></label>
          <input id={`${idPrefix}-phone`} className="input" type="tel" autoComplete="tel" maxLength={30} value={value.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+91 98765 43210" aria-invalid={Boolean(errors.phone)} />
          <Err>{errors.phone}</Err>
        </div>
        <div>
          <label className="label" htmlFor={`${idPrefix}-web`}>Website <span className="muted font-normal">(optional)</span></label>
          <input id={`${idPrefix}-web`} className="input" type="url" maxLength={300} value={value.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://" aria-invalid={Boolean(errors.website)} />
          <Err>{errors.website}</Err>
        </div>
      </div>
      <HostTermsNotice />
      <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-5 text-ink">
        <input type="checkbox" checked={value.acceptTerms} onChange={(e) => set({ acceptTerms: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ds-brand)]" />
        <span>I agree to these terms for conducting quizzes on Tectum, and that my account is reviewed before hosting is switched on.</span>
      </label>
      <Err>{errors.acceptTerms}</Err>
    </div>
  );
}

/** "Conduct tests on Tectum": the application, from the Tests page. */
export function ApplyToHostModal({ open, onClose }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState(() => blankApplication(user));
  const [errors, setErrors] = useState({});
  const apply = useApplyToHost();
  const send = () => {
    const e = applicationErrors(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    apply.mutate(form, {
      onSuccess: (d) => {
        toast(d.message);
        setUser({ ...user, quizHost: 'pending' });
        onClose();
      },
      onError: (err) => setErrors({ form: err.message }),
    });
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Conduct quizzes on Tectum"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={send} disabled={apply.isPending}>
            <Building2 className="h-4 w-4" /> {apply.isPending ? 'Sending…' : 'Send application'}
          </button>
        </div>
      }
    >
      <div className="space-y-3 px-5 py-4">
        <p className="text-[14px] text-ds-fg-2">
          Coaching institutes, colleges, societies and individual teachers can host proctored tests. Your tests appear on your profile and in Tests → Quizzes, where students register and you accept them.
        </p>
        <HostApplicationFields value={form} onChange={setForm} errors={errors} idPrefix="apply" />
        <Err>{errors.form}</Err>
      </div>
    </Modal>
  );
}
