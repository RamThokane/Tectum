import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  ShieldCheck,
  Bell,
  Palette,
  BadgeCheck,
  Lock,
  Moon,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Sun,
  Download,
  Trash2,
  LogOut,
  Clock,
  Check,
  PauseCircle,
  LifeBuoy,
  Users,
} from 'lucide-react';
import HelpSection from '../components/HelpSection';
import AccountsSection from '../components/AccountsSection';
import { api, API_ORIGIN } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useUIStore, toast } from '../store/ui';
import { PageShell } from '../components/Layout';
import Avatar from '../components/Avatar';
import { Tick, hasBlueTick } from '../components/VerificationBadge';
import TagInput from '../components/TagInput';
import FileUploadZone from '../components/FileUploadZone';
import PasswordChecklist, { usePasswordChecked } from '../components/PasswordChecklist';
import { isStrongPassword } from '../lib/passwordRules';
import CoverPhoto from '../components/CoverPhoto';
import VerifyModal from '../components/VerifyModal';
import { Modal, PasswordInput, Toggle } from '../components/ui';
import { IMAGE_ACCEPT, MAX_IMAGE_MB, roleLabel } from '../lib/constants';
import RoleSelect from '../components/RoleSelect';
import { cn } from '../lib/format';

import { coursesForRole, courseFitsRole } from '../lib/courses';
import { COUNTRIES } from '../lib/countries';
const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'account', label: 'Account & Security', icon: Lock },
  { id: 'accounts', label: 'Switch or Manage Accounts', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'App Appearance', icon: Palette },
  { id: 'verification', label: 'Verification & Blue tick', icon: BadgeCheck },
  { id: 'privacy', label: 'Privacy & Data', icon: ShieldCheck },
  { id: 'help', label: 'Help & Support', icon: LifeBuoy },
];

function Panel({ title, description, children, footer }) {
  return (
    <section className="card">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-editorial text-[20px] font-medium leading-[26px]">{title}</h2>
        {description && <p className="muted mt-0.5 text-[13px] leading-[18px]">{description}</p>}
      </div>
      <div className="space-y-4 p-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
    </section>
  );
}

// ---------------- Profile ----------------
function ProfileSection({ me }) {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const initial = { name: me.name, role: me.role, designation: me.designation || '', institution: me.institution || '', course: me.course || '', country: me.country || '', bio: me.bio || '', specialtyTags: me.specialtyTags || [] };
  const [form, setForm] = useState(initial);
  const [avatar, setAvatar] = useState([]);
  const [cover, setCover] = useState([]);
  const [removeCover, setRemoveCover] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || avatar.length > 0 || cover.length > 0 || removeCover;

  const save = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      // course / country are only sent once chosen (older accounts may not have them yet)
      Object.entries(form).forEach(([k, v]) => (['course', 'country'].includes(k) && !v ? null : fd.append(k, k === 'specialtyTags' ? JSON.stringify(v) : v)));
      if (avatar[0]) fd.append('profilePicture', avatar[0]);
      if (cover[0]) fd.append('coverPhoto', cover[0]);
      else if (removeCover) fd.append('removeCover', 'true');
      return api.put(`/users/${me._id}`, fd).then((r) => r.data.user);
    },
    onSuccess: (u) => {
      setUser(u);
      setAvatar([]);
      setCover([]);
      setRemoveCover(false);
      qc.invalidateQueries({ queryKey: ['user', me._id] });
      qc.invalidateQueries({ queryKey: ['posts'] });
      toast('Profile saved');
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const roleChanged = form.role !== me.role && me.verificationStatus === 'verified';

  return (
    <Panel
      title="Profile"
      description="How other members see you on Tectum."
      footer={
        <>
          <Link to={`/profile/${me._id}`} className="btn-ghost">View profile</Link>
          <button className="btn-primary" disabled={!dirty || save.isPending || form.name.trim().length < 2} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <div>
        <label className="label">Cover photo</label>
        <div className="overflow-hidden rounded-[20px] ring-1 ring-line">
          <CoverPhoto user={removeCover ? null : me} className="h-24 sm:h-28" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1">
            <FileUploadZone
              files={cover}
              onChange={(f) => {
                setCover(f);
                setRemoveCover(false);
              }}
              accept={IMAGE_ACCEPT}
              maxSizeMB={MAX_IMAGE_MB}
              compact
              label={me.coverPhoto ? 'Change cover' : 'Add a cover photo'}
              hint={`Wide images look best · up to ${MAX_IMAGE_MB} MB`}
            />
          </div>
          {me.coverPhoto && !removeCover && !cover.length && (
            <button type="button" className="btn-secondary" onClick={() => setRemoveCover(true)}>
              Remove cover
            </button>
          )}
          {removeCover && <p className="muted text-[12px]">Cover will go back to the default cover when you save.</p>}
        </div>
        <p className="muted mt-1.5 text-[12px]">Shown behind your profile header and your welcome banner on Home.</p>
      </div>

      <div className="flex items-center gap-4">
        <Avatar user={me} size="lg" />
        <div className="flex-1">
          <FileUploadZone files={avatar} onChange={setAvatar} accept={IMAGE_ACCEPT} maxSizeMB={MAX_IMAGE_MB} compact label="Change photo" hint={`Up to ${MAX_IMAGE_MB} MB`} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="s-name">Full name</label>
          <input id="s-name" className="input" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="s-role">Role</label>
          <RoleSelect id="s-role" role={form.role} designation={form.designation} onChange={(v) => setForm({ ...form, ...v, ...(v.role && !courseFitsRole(form.course, v.role) ? { course: '' } : {}) })} />
        </div>
      </div>
      {roleChanged && <p className="text-[12px] text-warning">Changing your role removes your tick until you verify again.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="s-course">Course / degree</label>
          <select id="s-course" className="input" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
            <option value="">Choose your course…</option>
            {coursesForRole(form.role).map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="s-country">Country</label>
          <select id="s-country" className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} autoComplete="country">
            <option value="">Choose your country…</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="s-inst">Institution</label>
        <input id="s-inst" className="input" maxLength={120} value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="University or hospital" />
      </div>
      <div>
        <label className="label" htmlFor="s-bio">Professional overview</label>
        <textarea id="s-bio" className="input" rows={4} maxLength={500} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Your background, clinical interests and what you share on Tectum" />
        <p className="muted ds-num mt-1 text-right text-[12px]">{form.bio.length}/500</p>
      </div>
      <div>
        <label className="label">Clinical expertise</label>
        <TagInput value={form.specialtyTags} onChange={(specialtyTags) => setForm({ ...form, specialtyTags })} max={12} />
      </div>
    </Panel>
  );
}

// ---------------- Account & Security ----------------
function AccountSection({ me }) {
  const setSession = useAuthStore((s) => s.setSession);
  const prefs = usePreferences();
  const allowMentions = me.preferences?.allowMentions !== false;
  const [email, setEmail] = useState({ email: me.email, password: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwChecked, pwBlur, setPwChecked] = usePasswordChecked();

  const saveEmail = useMutation({
    mutationFn: () => api.put('/users/me/email', email).then((r) => r.data),
    onSuccess: (d) => {
      setSession(d.user);
      setEmail({ email: d.user.email, password: '' });
      toast(d.message);
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const savePassword = useMutation({
    mutationFn: () => api.put('/users/me/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword }).then((r) => r.data),
    onSuccess: (d) => {
      setSession(useAuthStore.getState().user, d.token);
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      setPwChecked(false);
      toast(d.message);
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const everywhere = useMutation({
    mutationFn: () => api.post('/users/me/logout-everywhere').then((r) => r.data),
    onSuccess: (d) => {
      setSession(useAuthStore.getState().user, d.token);
      toast(d.message);
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const pwMismatch = pw.confirm && pw.confirm !== pw.newPassword;
  // Google accounts have no password until the member sets one here.
  const hasPassword = me.hasPassword !== false;

  return (
    <div className="space-y-4">
      <Panel
        title="Email address"
        description={
          hasPassword
            ? 'Used to log in. Enter your password to confirm the change.'
            : 'Used to log in. Set a password below before you can change this.'
        }
        footer={
          <button className="btn-primary" disabled={!email.password || email.email === me.email || saveEmail.isPending} onClick={() => saveEmail.mutate()}>
            Update email
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="s-email">Email</label>
            <input id="s-email" type="email" className="input" value={email.email} onChange={(e) => setEmail({ ...email, email: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="s-email-pw">Current password</label>
            <PasswordInput id="s-email-pw" autoComplete="current-password" value={email.password} onChange={(e) => setEmail({ ...email, password: e.target.value })} />
          </div>
        </div>
      </Panel>

      <Panel
        title={hasPassword ? 'Change password' : 'Set a password'}
        description={
          hasPassword
            ? "After changing it, you'll stay logged in here and be logged out on other devices."
            : 'Your account signs in with Google. Adding a password lets you also log in with your email, and confirm changes like deleting your account.'
        }
        footer={
          <button
            className="btn-primary"
            disabled={(hasPassword && !pw.currentPassword) || !isStrongPassword(pw.newPassword) || pw.newPassword !== pw.confirm || savePassword.isPending}
            onClick={() => savePassword.mutate()}
          >
            {hasPassword ? 'Change password' : 'Set password'}
          </button>
        }
      >
        {hasPassword && (
          <div>
            <label className="label" htmlFor="s-pw-cur">Current password</label>
            <PasswordInput id="s-pw-cur" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="s-pw-new">New password</label>
            <PasswordInput id="s-pw-new" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} onBlur={pwBlur} aria-describedby="settings-pw-rules" />
          </div>
          <div>
            <label className="label" htmlFor="s-pw-confirm">Confirm new password</label>
            <PasswordInput id="s-pw-confirm" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            {pwMismatch && <p className="mt-1 text-[12px] text-danger">Passwords don't match.</p>}
          </div>
        </div>
        <PasswordChecklist id="settings-pw-rules" password={pw.newPassword} checked={pwChecked} />
      </Panel>

      <Panel title="Mentions" description="Control whether other members can tag you with @.">
        <Toggle
          label="Allow others to mention me"
          description={
            allowMentions
              ? 'On: members can @mention you in posts and comments, and you get notified.'
              : "Off: you won't appear when people type @, and your name won't be linked or notify you."
          }
          checked={allowMentions}
          onChange={(v) => prefs.mutate({ allowMentions: v }, { onSuccess: () => toast(v ? 'Mentions turned on' : 'Mentions turned off') })}
        />
      </Panel>

      <Panel title="Sessions" description="Lost a phone or used a shared computer? Sign out everywhere else.">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-ds-fg-2">Sign out of all other devices and browsers. You'll stay logged in here.</p>
          <button className="btn-secondary" disabled={everywhere.isPending} onClick={() => everywhere.mutate()}>
            <LogOut className="h-4 w-4" /> Sign out other devices
          </button>
        </div>
      </Panel>
    </div>
  );
}

// ---------------- Notifications ----------------
const NOTIFICATION_OPTIONS = [
  { key: 'like', label: 'Likes', description: 'When someone likes your post' },
  { key: 'comment', label: 'Comments', description: 'When someone comments on your post' },
  { key: 'reply', label: 'Replies', description: 'When someone replies to your comment' },
  { key: 'follow', label: 'New followers', description: 'When someone starts following you' },
  { key: 'repost', label: 'Reposts', description: 'When someone reposts your post' },
  { key: 'quote', label: 'Quotes', description: 'When someone quotes your post' },
  { key: 'notes_saved', label: 'Notes saved', description: 'When someone saves your study notes' },
  { key: 'mention', label: 'Mentions', description: 'When someone @mentions you in a post or comment' },
];

function usePreferences() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (body) => api.put('/users/me/preferences', body).then((r) => r.data.user),
    onMutate: (body) => {
      // Optimistic: reflect the switch immediately.
      const prev = useAuthStore.getState().user.preferences ?? {};
      setUser({
        preferences: {
          ...prev,
          ...(body.showSensitive !== undefined ? { showSensitive: body.showSensitive } : {}),
          ...(body.allowMentions !== undefined ? { allowMentions: body.allowMentions } : {}),
          notifications: { ...prev.notifications, ...body.notifications },
        },
      });
      return prev;
    },
    onSuccess: (u) => setUser({ preferences: u.preferences }),
    onError: (e, _b, prev) => {
      setUser({ preferences: prev });
      toast(e.message, 'error');
    },
  });
}

function NotificationsSection({ me }) {
  const prefs = usePreferences();
  const popups = useUIStore((s) => s.popups);
  const setPopups = useUIStore((s) => s.setPopups);
  const n = me.preferences?.notifications ?? {};
  return (
    <div className="space-y-4">
      <Panel title="Notify me about" description="Turned-off activity won't appear in your notifications at all.">
        {NOTIFICATION_OPTIONS.map((o) => (
          <Toggle
            key={o.key}
            label={o.label}
            description={o.description}
            checked={n[o.key] !== false}
            onChange={(v) => prefs.mutate({ notifications: { [o.key]: v } })}
          />
        ))}
      </Panel>
      <Panel title="Pop-up alerts" description="This setting applies to this browser.">
        <Toggle label="Show a pop-up when a new notification arrives" description="Appears at the bottom of the screen while you're using Tectum" checked={popups} onChange={setPopups} />
      </Panel>
    </div>
  );
}

// ---------------- Appearance ----------------
function Choice({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'relative flex flex-1 flex-col items-center gap-2 rounded-[12px] border p-4 text-[13px] font-medium transition active:scale-[0.98]',
        active ? 'border-link bg-ds-brand-soft text-link' : 'border-line-strong text-ds-fg-2 hover:bg-surface-2 hover:text-ink'
      )}
    >
      {active && <Check className="absolute right-2 top-2 h-4 w-4 text-link" strokeWidth={2} />}
      {children}
    </button>
  );
}

function AppearanceSection() {
  const { themeChoice, setTheme, textSize, setTextSize } = useUIStore();
  return (
    <Panel title="App Appearance" description="These settings apply to this browser.">
      <div>
        <p className="label">Theme</p>
        <div className="flex gap-3">
          <Choice active={themeChoice === 'dark'} onClick={() => setTheme('dark')}>
            <div className="flex h-14 w-full items-center justify-center rounded-[6px] bg-[#0b0d12] text-[#eceef2]"><Moon className="h-5 w-5" strokeWidth={1.5} /></div>
            Dark
          </Choice>
          <Choice active={themeChoice === 'light'} onClick={() => setTheme('light')}>
            <div className="flex h-14 w-full items-center justify-center rounded-[6px] border border-[#e5e8ed] bg-[#f6f7f9] text-[#0e1116]"><Sun className="h-5 w-5" strokeWidth={1.5} /></div>
            Light
          </Choice>
          <Choice active={themeChoice === 'system'} onClick={() => setTheme('system')}>
            <div className="flex h-14 w-full items-center justify-center rounded-[6px] border border-[#e5e8ed] bg-[linear-gradient(135deg,#f6f7f9_50%,#0b0d12_50%)] text-[#8f97a6]"><Monitor className="h-5 w-5" strokeWidth={1.5} /></div>
            Match device
          </Choice>
        </div>
      </div>
      <div>
        <p className="label">Text size</p>
        <div className="flex gap-3">
          {[['sm', 'Small', 'text-[15px]'], ['md', 'Normal', 'text-[20px]'], ['lg', 'Large', 'text-[28px]']].map(([id, label, cls]) => (
            <Choice key={id} active={textSize === id} onClick={() => setTextSize(id)}>
              <span className={cn('font-editorial font-medium leading-8', cls)}>Aa</span>
              {label}
            </Choice>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ---------------- Verification ----------------
function VerificationSection({ me }) {
  const [modal, setModal] = useState(null);
  const status = me.verificationStatus;
  const blue = hasBlueTick(me);
  const steps = [
    { done: status !== 'unverified', label: 'Licence or ID uploaded' },
    { done: blue, pending: status === 'pending', label: 'Document approved: you get the blue tick, free' },
  ];
  return (
    <Panel title="Verification & Blue tick" description="The blue tick shows other members that you're a verified healthcare professional or student. It's free.">
      <div className="flex items-center gap-3 rounded-[12px] border border-line p-4">
        <Avatar user={me} size="md" />
        <div>
          <p className="flex items-center gap-1 font-semibold">{me.name} <Tick user={me} /></p>
          <p className="muted text-[13px]">
            {blue ? `Verified ${roleLabel(me.role)} · blue tick` : status === 'pending' ? 'Verification under review' : 'Not verified yet'}
          </p>
        </div>
      </div>
      <ol className="space-y-2.5">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-3 text-[15px]">
            <span className={cn('flex h-6 w-6 items-center justify-center rounded-full', s.done ? 'bg-ds-brand text-ds-on-brand' : s.pending ? 'bg-warning-soft text-warning' : 'border border-line-strong')}>
              {s.done ? <Check className="h-3.5 w-3.5" /> : s.pending ? <Clock className="h-3.5 w-3.5" /> : null}
            </span>
            <span className={cn(!s.done && !s.pending && 'muted')}>{s.label}</span>
          </li>
        ))}
      </ol>
      {blue && (
        <p className="muted text-[13px]">Your posts get priority in the feed, you can write longer posts, and you don't see ads.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {status === 'unverified' && <button className="btn-primary" onClick={() => setModal('verify')}><BadgeCheck className="h-4 w-4" /> Upload document</button>}
        {status === 'pending' && (
          <a className="btn-secondary" href={`${API_ORIGIN}/api/users/${me._id}/verification-document`} target="_blank" rel="noreferrer">View submitted document</a>
        )}
      </div>
      {modal === 'verify' && <VerifyModal userId={me._id} onClose={() => setModal(null)} />}
    </Panel>
  );
}

// ---------------- Privacy & Data ----------------
function PrivacySection({ me }) {
  const prefs = usePreferences();
  const clear = useAuthStore((s) => s.signOut);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivatePw, setDeactivatePw] = useState('');

  const deactivate = useMutation({
    mutationFn: () => api.post('/users/me/deactivate', { password: deactivatePw }).then((r) => r.data),
    onSuccess: (d) => {
      clear();
      qc.clear();
      toast(d.message);
      navigate('/', { replace: true });
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const del = useMutation({
    mutationFn: () => api.delete('/users/me', { data: { password } }).then((r) => r.data),
    onSuccess: (d) => {
      clear();
      qc.clear();
      toast(d.message);
      navigate('/', { replace: true });
    },
    onError: (e) => toast(e.message, 'error'),
  });

  return (
    <div className="space-y-4">
      <Panel title="Content">
        <Toggle
          label="Show sensitive clinical images without blur"
          description="By default, images marked sensitive are blurred until you tap to see them."
          checked={Boolean(me.preferences?.showSensitive)}
          onChange={(v) => prefs.mutate({ showSensitive: v })}
        />
      </Panel>

      <Panel title="Your data" description="Download a copy of your profile, posts, comments and saved items.">
        <a className="btn-secondary w-fit" href={`${API_ORIGIN}/api/users/me/export`} download>
          <Download className="h-4 w-4" /> Download my data (JSON)
        </a>
      </Panel>

      <section className="card">
        <div className="px-5 py-4">
          <h2 className="font-editorial text-[20px] font-medium leading-[26px]">Deactivate account</h2>
          <p className="muted mt-0.5 text-[13px] leading-[18px]">
            Take a break without losing anything. While deactivated, your profile, posts and comments are hidden from
            everyone and you won't appear in search. <strong>Log in again any time to reactivate</strong>. Everything comes back as it was.
          </p>
          <button className="btn-secondary mt-4" onClick={() => setDeactivateOpen(true)}>
            <PauseCircle className="h-4 w-4" /> Deactivate my account
          </button>
        </div>
      </section>

      <Modal
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        title="Deactivate your account?"
        size="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDeactivateOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={!deactivatePw || deactivate.isPending} onClick={() => deactivate.mutate()}>
              {deactivate.isPending ? 'Deactivating…' : 'Deactivate'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 p-5">
          <ul className="space-y-1.5 text-[15px]">
            <li>• Your profile, posts and comments will be hidden.</li>
            <li>• You'll be logged out on all devices.</li>
            <li>• Nothing is deleted. Log in with your email and password to come back.</li>
          </ul>
          <div>
            <label className="label" htmlFor="deact-pw">Your password</label>
            <PasswordInput id="deact-pw" value={deactivatePw} onChange={(e) => setDeactivatePw(e.target.value)} />
          </div>
        </div>
      </Modal>

      <section className="card border-danger/40">
        <div className="px-5 py-4">
          <h2 className="font-editorial text-[20px] font-medium leading-[26px] text-danger">Delete account</h2>
          <p className="muted mt-0.5 text-[13px] leading-[18px]">
            Permanently deletes your profile, posts, comments, likes and followers. This cannot be undone.
          </p>
          <button className="btn-danger mt-4" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete my account
          </button>
        </div>
      </section>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete your account?"
        size="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button className="btn-danger" disabled={typed !== 'DELETE' || !password || del.isPending} onClick={() => del.mutate()}>
              {del.isPending ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 p-5">
          <p className="text-[15px]">Everything you've shared on Tectum will be removed. Consider downloading your data first.</p>
          <div>
            <label className="label" htmlFor="del-pw">Your password</label>
            <PasswordInput id="del-pw" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="del-type">Type <strong>DELETE</strong> to confirm</label>
            <input id="del-type" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function Settings() {
  const me = useAuthStore((s) => s.user);
  const [params, setParams] = useSearchParams();
  const chosen = params.get('section');
  // Desktop shows Profile when nothing is chosen; phones show the vertical list of sections instead.
  const section = SECTIONS.find((s) => s.id === chosen) ?? SECTIONS[0];
  const go = (id) => setParams({ section: id }, { replace: false });
  const backToList = () => setParams({}, { replace: false });

  return (
    <PageShell bare wide title="Settings">
      <div className="flex flex-col gap-4 md:flex-row md:px-0">
        {/* phones: a vertical list (hidden once a section is open); desktop: the side list */}
        <nav className={cn('flex-col gap-1 p-2 md:flex md:w-[17rem] md:shrink-0 md:p-0', chosen ? 'hidden' : 'flex')} aria-label="Settings sections">
          {SECTIONS.map((s) => {
            const active = section.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                aria-current={active && chosen ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[15px] font-medium transition-colors md:min-h-10',
                  // phones: a plain list; desktop: the open section in soft blue
                  active ? 'text-ink md:bg-ds-brand-soft md:text-link' : 'text-ink hover:bg-surface-2 md:text-ds-fg-2 md:hover:text-ink'
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line md:h-auto md:w-auto md:border-0">
                  <s.icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </span>
                <span className="flex-1">{s.label}</span>
                <ChevronRight className="h-4 w-4 text-ds-fg-3 md:hidden" strokeWidth={1.5} aria-hidden="true" />
              </button>
            );
          })}
        </nav>
        <div className={cn('min-w-0 flex-1 md:block', chosen ? 'block' : 'hidden')}>
          <button onClick={backToList} className="btn-ghost mx-2 mt-1 min-h-11 px-2 text-[13px] md:hidden">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} /> All settings
          </button>
          {section.id === 'profile' && <ProfileSection key={me._id} me={me} />}
          {section.id === 'account' && <AccountSection me={me} />}
          {section.id === 'accounts' && <AccountsSection />}
          {section.id === 'notifications' && <NotificationsSection me={me} />}
          {section.id === 'appearance' && <AppearanceSection />}
          {section.id === 'verification' && <VerificationSection me={me} />}
          {section.id === 'privacy' && <PrivacySection me={me} />}
          {section.id === 'help' && <HelpSection />}
        </div>
      </div>
    </PageShell>
  );
}