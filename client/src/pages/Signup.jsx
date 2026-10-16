import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, Stethoscope, Check, ArrowLeft } from 'lucide-react';
import { HostApplicationFields, applicationErrors, blankApplication } from '../components/quiz/Hosting';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { ROLES, IMAGE_ACCEPT, MAX_IMAGE_MB } from '../lib/constants';
import { slugsForCourse } from '../lib/specialties';
import RoleSelect from '../components/RoleSelect';
import { cn } from '../lib/format';
import SpecialtyTagChip from '../components/SpecialtyTagChip';
import TagInput from '../components/TagInput';
import FileUploadZone from '../components/FileUploadZone';
import { AVATAR_CROP } from '../components/ImageCropper';
import { PasswordInput } from '../components/ui';
import GoogleButton, { AuthDivider, useGoogleClientId } from '../components/GoogleButton';
import AuthShell, { FieldError } from './AuthShell';
import { coursesForRole, courseFitsRole } from '../lib/courses';
import { COUNTRIES } from '../lib/countries';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import PasswordChecklist, { usePasswordChecked } from '../components/PasswordChecklist';
import { isStrongPassword, passwordProblem } from '../lib/passwordRules';

const ROLE_ICONS = { student: GraduationCap, doctor: Stethoscope };
// Sign-up offers these two (older accounts may have other roles).
const SIGNUP_ROLES = ROLES.filter((r) => r.value in ROLE_ICONS);
const STEPS = ['Account', 'Role', 'Specialties', 'Profile'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Signup() {
  useDocumentTitle('Sign up');
  // Arriving from "Continue with Google" on the login page: name and email are already known.
  const fromGoogle = useLocation().state?.google ?? null;
  const [google, setGoogle] = useState(fromGoogle);
  const [step, setStep] = useState(fromGoogle ? 1 : 0);
  const [form, setForm] = useState({
    name: fromGoogle?.name ?? '', email: fromGoogle?.email ?? '', password: '', role: '', course: '', country: 'IN', specialtyTags: [], institution: '', designation: '', bio: '', acceptTerms: false,
  });
  const [avatar, setAvatar] = useState([]);
  // "Will you use this platform to conduct quizzes?" - the application an admin approves
  const [hosting, setHosting] = useState(false);
  const [hostApp, setHostApp] = useState(() => blankApplication());
  const [errors, setErrors] = useState({});
  const [pwChecked, pwBlur] = usePasswordChecked();
  const [submitting, setSubmitting] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const googleClientId = useGoogleClientId();
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (form.name.trim().length < 2) e.name = 'Please enter your full name';
      if (!EMAIL_RE.test(form.email)) e.email = 'Enter a valid email';
      if (!google && !isStrongPassword(form.password)) e.password = `Your password doesn't meet the rules yet. ${passwordProblem(form.password)}.`;
    }
    if (step === 1 && !form.role) e.role = 'Choose the option that describes you best';
    if (step === 1 && !form.course) e.course = 'Choose your course';
    if (step === 1 && !form.country) e.country = 'Choose your country';
    if (step === 1 && hosting) {
      const h = applicationErrors(hostApp);
      if (Object.keys(h).length) e.host = h;
    }
    if (step === 3 && !form.acceptTerms) e.terms = 'Please tick the box to accept the terms';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Students skip "Specialties" (clinical expertise): Role -> Profile.
  const isStudent = form.role === 'student';
  const steps = isStudent ? STEPS.filter((s) => s !== 'Specialties') : STEPS;
  const next = () => validateStep() && setStep((s) => s + (s === 1 && isStudent ? 2 : 1));
  const back = () => setStep((s) => s - (s === 3 && isStudent ? 2 : 1));

  // Email check (step 1, email sign-ups): a 6-digit code is emailed and must be entered before going on.
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [proof, setProof] = useState(null); // { email, token } once the code was right
  const verified = proof?.email === form.email.trim().toLowerCase();

  const sendCode = async () => {
    setSubmitting(true);
    setErrors({});
    try {
      const { data } = await api.post('/auth/signup/send-code', { email: form.email });
      if (!data.required) return setStep(1); // email isn't set up on the server: no check
      setCodeSent(true);
      setCode('');
    } catch (err) {
      setErrors({ [err.response?.status === 409 ? 'email' : 'code']: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const checkCode = async () => {
    if (!/^\d{6}$/.test(code.trim())) return setErrors({ code: 'Enter the 6-digit code from the email' });
    setSubmitting(true);
    setErrors({});
    try {
      const { data } = await api.post('/auth/signup/verify-code', { email: form.email, code: code.trim() });
      setProof({ email: form.email.trim().toLowerCase(), token: data.emailProof });
      setStep(1);
    } catch (err) {
      setErrors({ code: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const accountStep = () => {
    if (!validateStep()) return;
    if (google || verified) return setStep(1);
    if (codeSent) checkCode();
    else sendCode();
  };

  /** Google button on step 1: known members are logged straight in, new ones carry on to "Role". */
  const withGoogle = async (credential) => {
    setSubmitting(true);
    setErrors({});
    try {
      const { data } = await api.post('/auth/google', { credential });
      if (data.newUser) {
        setGoogle({ credential, ...data.profile });
        set({ name: data.profile.name, email: data.profile.email, password: '' });
        setStep(1);
        return;
      }
      setSession(data.user, data.token);
      navigate('/home', { replace: true });
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    setErrors({});
    try {
      const hostApplication = hosting ? hostApp : undefined;
      const { data } = google
        ? await api.post('/auth/google', { credential: google.credential, name: form.name, role: form.role, course: form.course, country: form.country, specialtyTags: form.specialtyTags, institution: form.institution, designation: form.designation, bio: form.bio, acceptTerms: form.acceptTerms, hostApplication })
        : await api.post('/auth/signup', { ...form, hostApplication, emailProof: verified ? proof.token : undefined });
      setSession(data.user, data.token);
      if (avatar[0]) {
        const fd = new FormData();
        fd.append('profilePicture', avatar[0]);
        const res = await api.put(`/users/${data.user._id}`, fd).catch(() => null);
        if (res) setSession(res.data.user);
      }
      navigate('/home', { replace: true });
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 && google) {
        // The Google credential expires after about an hour.
        setGoogle(null);
        setStep(0);
        setErrors({ form: 'That Google sign-in expired. Please try "Continue with Google" again.' });
      } else if (status === 409) {
        setStep(0);
        setErrors({ email: err.message });
      } else if (/verify your email/i.test(err.message)) {
        // the check expired (after 2 hours): back to step 1 for a fresh code
        setProof(null);
        setCodeSent(false);
        setStep(0);
        setErrors({ code: 'Please verify your email again. Tap Continue to get a new code.' });
      } else {
        setErrors({ form: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTag = (t) =>
    set({ specialtyTags: form.specialtyTags.includes(t) ? form.specialtyTags.filter((x) => x !== t) : [...form.specialtyTags, t].slice(0, 12) });

  return (
    <AuthShell
      title="Join Tectum"
      subtitle={`Step ${steps.indexOf(STEPS[step]) + 1} of ${steps.length} · ${STEPS[step]}`}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-link hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {google && (
        <p className="mb-5 rounded-[12px] bg-ds-brand-soft px-4 py-3 text-[13px] text-ds-brand-text">
          Continuing with Google as <span className="font-semibold">{google.email}</span>. You'll sign in with the Google button from now on.
        </p>
      )}

      {/* progress */}
      <ol className="mb-6 flex gap-1.5" aria-label="Signup progress">
        {steps.map((s) => (
          <li key={s} className={cn('h-1.5 flex-1 rounded-full transition', STEPS.indexOf(s) <= step ? 'bg-ds-brand' : 'bg-surface-3')}>
            <span className="sr-only">{s}{STEPS.indexOf(s) < step ? ' (done)' : ''}</span>
          </li>
        ))}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 0) accountStep();
          else if (step < STEPS.length - 1) next();
          else submit();
        }}
        noValidate
      >
        {step === 0 && (
          <div className="space-y-4">
            {googleClientId && (
              <div>
                <GoogleButton onCredential={withGoogle} text="signup_with" disabled={submitting} oneTap={!google} context="signup" />
                <AuthDivider>or sign up with your email</AuthDivider>
              </div>
            )}
            <div>
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" className="input" autoComplete="name" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Dr. Jane Doe" />
              <FieldError>{errors.name}</FieldError>
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                autoComplete="email"
                value={form.email}
                onChange={(e) => {
                  set({ email: e.target.value });
                  setCodeSent(false); // a new address needs its own code
                }}
              />
              <FieldError>{errors.email}</FieldError>
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <PasswordInput id="password" autoComplete="new-password" value={form.password} onChange={(e) => { set({ password: e.target.value }); if (isStrongPassword(e.target.value)) setErrors((er) => ({ ...er, password: undefined })); }} onBlur={pwBlur} aria-describedby="signup-pw-rules" aria-invalid={Boolean(errors.password)} />
              <FieldError>{errors.password}</FieldError>
              <PasswordChecklist id="signup-pw-rules" password={form.password} checked={pwChecked || Boolean(errors.password)} />
            </div>
            {codeSent && !verified && (
              <div className="rounded-[12px] bg-ds-brand-soft p-4">
                <label className="label" htmlFor="signup-code">Enter the code we emailed you</label>
                <p className="muted mb-2 text-[13px]">
                  We sent a 6-digit code to <span className="font-semibold">{form.email}</span>. Check your inbox, and your spam folder too.
                </p>
                <input
                  id="signup-code"
                  className="input text-center text-[20px] tracking-[0.4em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ''));
                    setErrors((er) => ({ ...er, code: undefined }));
                  }}
                  aria-invalid={Boolean(errors.code)}
                />
                <FieldError>{errors.code}</FieldError>
                <button type="button" className="mt-2 text-[13px] font-medium text-link hover:underline" onClick={sendCode} disabled={submitting}>
                  Send a new code
                </button>
              </div>
            )}
            {!codeSent && <FieldError>{errors.code}</FieldError>}
            <FieldError>{errors.form}</FieldError>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="grid gap-2.5" role="radiogroup" aria-label="Your role">
              {SIGNUP_ROLES.map((r) => {
                const Icon = ROLE_ICONS[r.value];
                const active = form.role === r.value;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    key={r.value}
                    onClick={() => set({ role: r.value, designation: '', ...(courseFitsRole(form.course, r.value) ? {} : { course: '' }) })}
                    className={cn(
                      'flex items-center gap-3 rounded-[12px] border p-3.5 text-left transition active:scale-[0.99]',
                      active ? 'border-link bg-ds-brand-soft' : 'border-line-strong hover:bg-surface-2'
                    )}
                  >
                    <span className={cn('rounded-full p-2.5', active ? 'bg-ds-brand text-ds-on-brand' : 'border border-line text-ds-fg-2')}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[15px] font-semibold">{r.label}</span>
                      <span className="muted block text-[12px]">{r.blurb}</span>
                    </span>
                    {active && <Check className="h-5 w-5 text-link" strokeWidth={2} />}
                  </button>
                );
              })}
            </div>
            <FieldError>{errors.role}</FieldError>
            {form.role === 'doctor' && (
              <div className="mt-3">
                <label className="label" htmlFor="signup-specialty">Your specialty <span className="muted font-normal">(shown as your badge)</span></label>
                <RoleSelect id="signup-specialty" role={form.role} designation={form.designation} onChange={(v) => set(v)} />
                <p className="muted mt-1 text-[12px]">MBBS doctors keep "Doctor (MBBS)". Specialists pick their title, e.g. Cardiologist or Radiologist.</p>
              </div>
            )}
            {form.role && form.role !== 'student' && (
              <p className="muted mt-3 text-[12px]">You can upload a license or ID from your profile later to get a verified badge.</p>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="signup-course">
                  {form.role === 'student' ? 'Course' : 'Course / degree'} <span className="text-danger">*</span>
                </label>
                <select id="signup-course" className="input" value={form.course} onChange={(e) => { set({ course: e.target.value }); setErrors((er) => ({ ...er, course: undefined })); }} aria-invalid={Boolean(errors.course)}>
                  <option value="">Choose your course…</option>
                  {coursesForRole(form.role).map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.options.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <FieldError>{errors.course}</FieldError>
              </div>
              <div>
                <label className="label" htmlFor="signup-country">Country <span className="text-danger">*</span></label>
                <select id="signup-country" className="input" value={form.country} onChange={(e) => { set({ country: e.target.value }); setErrors((er) => ({ ...er, country: undefined })); }} aria-invalid={Boolean(errors.country)} autoComplete="country">
                  <option value="">Choose your country…</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                <FieldError>{errors.country}</FieldError>
              </div>
            </div>
            <div className={cn('mt-5 rounded-[12px] border p-3.5', hosting ? 'border-link' : 'border-line')}>
              <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-5">
                <input
                  type="checkbox"
                  checked={hosting}
                  onChange={(e) => {
                    setHosting(e.target.checked);
                    if (e.target.checked && !hostApp.orgName) setHostApp((h) => ({ ...h, orgName: form.name }));
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ds-brand)]"
                />
                <span>
                  <span className="block font-semibold">Will you use this platform as a quiz conducting platform / organization?</span>
                  <span className="muted block text-[13px]">For coaching institutes, colleges and teachers who want to host proctored tests. Tectum approves each host.</span>
                </span>
              </label>
              {hosting && (
                <div className="mt-3">
                  <HostApplicationFields
                    value={hostApp}
                    onChange={(v) => {
                      setHostApp(v);
                      setErrors((er) => ({ ...er, host: undefined }));
                    }}
                    errors={errors.host}
                    idPrefix="signup-host"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="muted mb-3 text-[13px]">Pick the areas you study or practice. We use these to personalise your feed.</p>
            <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
              {slugsForCourse(form.course).map((t) => (
                <SpecialtyTagChip key={t} tag={t} size="md" selected={form.specialtyTags.includes(t)} onToggle={toggleTag} />
              ))}
            </div>
            <div className="mt-4">
              <label className="label">Something else?</label>
              <TagInput value={form.specialtyTags} onChange={(specialtyTags) => set({ specialtyTags })} max={12} placeholder="Type a specialty and press Enter" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="label">Profile picture <span className="muted font-normal">(optional)</span></label>
              <FileUploadZone files={avatar} onChange={setAvatar} accept={IMAGE_ACCEPT} maxSizeMB={MAX_IMAGE_MB} compact label="Add a photo" hint={`JPG, PNG, WebP or GIF · you can crop it next`} crop={AVATAR_CROP} />
            </div>
            <div>
              <label className="label" htmlFor="institution">Institution</label>
              <input id="institution" className="input" maxLength={120} value={form.institution} onChange={(e) => set({ institution: e.target.value })} placeholder="University or hospital" />
            </div>
            <div>
              <label className="label" htmlFor="bio">Bio</label>
              <textarea id="bio" className="input" rows={3} maxLength={500} value={form.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="MS3 · interested in cardiology and medical education" />
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-line p-3.5 text-[13px] leading-[18px]">
              <input
                type="checkbox"
                checked={form.acceptTerms}
                onChange={(e) => set({ acceptTerms: e.target.checked })}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ds-brand)]"
              />
              <span>
                I am 18 or older and I agree to the{' '}
                <Link to="/legal/terms" target="_blank" className="text-link hover:underline">Terms of Service</Link>,{' '}
                <Link to="/legal/privacy" target="_blank" className="text-link hover:underline">Privacy Policy</Link> and{' '}
                <Link to="/legal/guidelines" target="_blank" className="text-link hover:underline">Community Guidelines</Link>.
                <span className="muted mt-0.5 block text-[13px]">I will never post information that could identify a patient.</span>
              </span>
            </label>
            <FieldError>{errors.terms}</FieldError>
            <FieldError>{errors.form}</FieldError>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          {step > (google ? 1 : 0) && (
            <button type="button" className="btn-secondary" onClick={back} disabled={submitting}>
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}
          <button type="submit" className="btn-primary flex-1 py-2.5" disabled={submitting}>
            {step === 0 && codeSent && !verified && !google ? (submitting ? 'Checking…' : 'Verify email') : step < STEPS.length - 1 ? (step === 2 && !form.specialtyTags.length ? 'Skip for now' : 'Continue') : submitting ? 'Creating account…' : 'Create account'}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
