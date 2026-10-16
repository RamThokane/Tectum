import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, BadgeCheck, FileSearch, Trash2, Check, X, Bot, LifeBuoy, Users, UserCog, Building2 } from 'lucide-react';
import { useUseDemoAccount } from '../hooks/useAccounts';
import { api, API_ORIGIN } from '../api/client';
import { cldUrl } from '../lib/cldUrl';
import { courseLabel } from '../lib/courses';
import { countryName } from '../lib/countries';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/ui';
import { PageShell } from '../components/Layout';
import AdsManager from '../components/AdsManager';
import PostCard from '../components/PostCard';
import Avatar from '../components/Avatar';
import VerificationBadge from '../components/VerificationBadge';
import { EmptyState, ErrorState, PageLoader, Toggle } from '../components/ui';
import { cn, timeAgo, pluralize } from '../lib/format';
import { plural } from '../lib/quiz';

/** One member's report: who, why (category + their words), when. */
function ReportLine({ r, labels }) {
  return (
    <li className="text-ds-fg-2">
      <span className="font-medium">{r.user?.name ?? 'User'}</span>: {labels?.[r.category] ?? 'Other'}
      {r.reason ? ` - ${r.reason}` : ''} <span className="muted">· {timeAgo(r.createdAt)}</span>
    </li>
  );
}

function ReportedReplies({ comments, labels }) {
  const qc = useQueryClient();
  const act = useMutation({
    mutationFn: ({ id, action }) => (action === 'dismiss' ? api.post(`/admin/comment-reports/${id}/dismiss`) : api.delete(`/admin/comments/${id}`)),
    onSuccess: (_d, { action }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
      toast(action === 'dismiss' ? 'Reply kept' : 'Reply removed');
    },
    onError: (e) => toast(e.message, 'error'),
  });
  return comments.map((c) => (
    <div key={c._id} className="space-y-2 border-b border-line p-3">
      <div className="rounded-[12px] bg-danger-soft px-4 py-3 text-[13px] sm:px-5">
        <p className="font-semibold text-danger">
          Reply · {pluralize(c.reports?.length ?? 0, 'report')}
          {c.hiddenByReports && ' · Hidden from members until you decide'}
        </p>
        <ul className="mt-1 space-y-0.5">
          {(c.reports ?? []).map((r, i) => (
            <ReportLine key={i} r={r} labels={labels} />
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <button className="btn-secondary py-1.5" onClick={() => act.mutate({ id: c._id, action: 'dismiss' })}>
            <Check className="h-4 w-4" /> Keep reply
          </button>
          <button className="btn-danger py-1.5" onClick={() => window.confirm('Remove this reply permanently?') && act.mutate({ id: c._id, action: 'remove' })}>
            <Trash2 className="h-4 w-4" /> Remove reply
          </button>
        </div>
      </div>
      <div className="card p-4 text-[14px]">
        <p className="muted text-[12px]">
          {c.author?.name ?? 'Deleted user'} on{' '}
          {c.post ? (
            <Link className="link" to={`/post/${c.post._id}`}>
              {c.post.title || c.post.caseStudy?.chiefComplaint?.replace(/==/g, '') || 'a post'}
            </Link>
          ) : (
            'a deleted post'
          )}
        </p>
        <p className="mt-1 whitespace-pre-wrap">{c.text}</p>
      </div>
    </div>
  ));
}

function Reports() {
  const qc = useQueryClient();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: () => api.get('/admin/reports').then((r) => r.data),
  });
  const act = useMutation({
    mutationFn: ({ id, action }) => (action === 'dismiss' ? api.post(`/admin/reports/${id}/dismiss`) : api.delete(`/admin/posts/${id}`)),
    onSuccess: (_d, { action }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
      qc.invalidateQueries({ queryKey: ['posts'] });
      toast(action === 'dismiss' ? 'Report dismissed' : 'Post removed');
    },
    onError: (e) => toast(e.message, 'error'),
  });

  if (isPending) return <PageLoader />;
  if (isError) return <ErrorState error={error} />;
  if (!data.posts.length && !data.comments?.length) return <EmptyState icon={Flag} title="No reported posts or replies">The queue is clear.</EmptyState>;

  return (
    <>
      <p className="muted px-4 py-2 text-[12px]">
        Items are hidden from members after {data.hideAfter} reports (2 for &quot;Identifies a patient&quot;). Keep shows them again; Remove deletes them and tells the author.
      </p>
      {data.posts.map((post) => (
    <div key={post._id} className="space-y-2 border-b border-line p-3">
      <div className="rounded-[12px] bg-danger-soft px-4 py-3 text-[13px] sm:px-5">
        <p className="font-semibold text-danger">
          {[
            post.reports.length > 0 && `${pluralize(post.reports.length, 'report')}`,
            post.hiddenByReports && 'Hidden from members until you decide',
            post.aiReview?.status === 'flagged' && 'Flagged by AI image review',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {post.aiReview?.reasons?.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {post.aiReview.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-ds-fg-2">
                <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {r}
              </li>
            ))}
          </ul>
        )}
        <ul className="mt-1 space-y-0.5">
          {post.reports.map((r, i) => (
            <ReportLine key={i} r={r} labels={data.labels} />
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <button className="btn-secondary py-1.5" onClick={() => act.mutate({ id: post._id, action: 'dismiss' })}>
            <Check className="h-4 w-4" /> Keep post
          </button>
          <button
            className="btn-danger py-1.5"
            onClick={() => window.confirm('Remove this post permanently?') && act.mutate({ id: post._id, action: 'remove' })}
          >
            <Trash2 className="h-4 w-4" /> Remove post
          </button>
        </div>
      </div>
      <div className="card overflow-hidden">
        <PostCard post={{ ...post, likeCount: post.likes?.length ?? 0, repostCount: post.reposts?.length ?? 0 }} full />
      </div>
    </div>
      ))}
      <ReportedReplies comments={data.comments ?? []} labels={data.labels} />
    </>
  );
}

function Verifications() {
  const qc = useQueryClient();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin', 'verifications'],
    queryFn: () => api.get('/admin/verifications').then((r) => r.data.users),
  });
  const decide = useMutation({
    mutationFn: ({ id, status }) => api.post(`/admin/verifications/${id}`, { status }),
    onSuccess: (_d, { status }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'verifications'] });
      toast(status === 'verified' ? 'User verified' : 'Verification rejected');
    },
    onError: (e) => toast(e.message, 'error'),
  });

  if (isPending) return <PageLoader />;
  if (isError) return <ErrorState error={error} />;
  if (!data.length) {
    return (
      <EmptyState icon={BadgeCheck} title="No pending verifications">
        Approving a document gives that member the blue tick.
      </EmptyState>
    );
  }

  return (
    <ul>
      {data.map((u) => (
        <li key={u._id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-4 sm:px-5">
          <Avatar user={u} />
          <div className="min-w-0 flex-1">
            <Link to={`/profile/${u._id}`} className="font-semibold hover:underline">{u.name}</Link>
            <div className="flex items-center gap-2"><VerificationBadge user={u} /> <span className="muted truncate text-[12px]">{u.email}</span></div>
            {u.institution && <p className="muted text-[12px]">{u.institution}</p>}
          </div>
          <div className="flex gap-2">
            <a className="btn-secondary py-1.5" href={`${API_ORIGIN}/api/users/${u._id}/verification-document`} target="_blank" rel="noreferrer">
              <FileSearch className="h-4 w-4" /> Document
            </a>
            <button className="btn-primary py-1.5" onClick={() => decide.mutate({ id: u._id, status: 'verified' })}>
              <Check className="h-4 w-4" /> Approve
            </button>
            <button className="btn-secondary py-1.5 text-danger" onClick={() => decide.mutate({ id: u._id, status: 'unverified' })} aria-label="Reject">
              <X className="h-4 w-4" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

const HOST_FILTERS = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
];

/**
 * Applications to conduct quizzes (sent at sign-up or from Tests). Approve switches hosting on for
 * that account; Reject (with an optional reason) tells them. Approved hosts can be switched off.
 */
function QuizHosts() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending');
  const [notes, setNotes] = useState({});
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin', 'quiz-hosts', status],
    queryFn: () => api.get('/admin/quiz-hosts', { params: { status } }).then((r) => r.data),
  });
  const decide = useMutation({
    mutationFn: ({ id, status: s, note }) => api.post(`/admin/quiz-hosts/${id}`, { status: s, note }).then((r) => r.data),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['admin', 'quiz-hosts'] });
      qc.invalidateQueries({ queryKey: ['admin', 'members'] });
      toast(d.status === 'approved' ? 'Approved: they can now conduct quizzes' : 'Application rejected');
    },
    onError: (e) => toast(e.message, 'error'),
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
        {HOST_FILTERS.map(([id, label]) => (
          <button key={id} onClick={() => setStatus(id)} className={cn('rounded-full px-3 py-1.5 text-[12px] font-semibold', status === id ? 'bg-ds-brand text-white' : 'bg-surface-2')}>
            {label}
            {id === 'pending' && data?.pending ? ` (${data.pending})` : ''}
          </button>
        ))}
        <p className="muted w-full text-[12px] sm:ml-auto sm:w-auto">Each host's first {data?.freeTests ?? 2} published quizzes are free; later ones are marked "upload charge".</p>
      </div>
      {isPending ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState error={error} />
      ) : !data.applications.length ? (
        <EmptyState icon={Building2} title={status === 'pending' ? 'No pending quiz-host requests' : `No ${status} applications`}>
          {status === 'pending' ? 'Members who ask to conduct quizzes (at sign-up or from Tests) appear here.' : null}
        </EmptyState>
      ) : (
        <ul>
          {data.applications.map((a) => (
            <li key={a._id} className="border-b border-line px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar user={a.user} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">
                    {a.orgName}
                    {a.user && (
                      <span className="muted font-normal">
                        {' '}· <Link to={`/profile/${a.user._id}`} className="hover:underline">{a.user.name}</Link>
                        {a.user.username ? ` @${a.user.username}` : ''}
                      </span>
                    )}
                  </p>
                  <p className="muted text-[12px]">
                    {a.user ? `${a.user.email} · ${[courseLabel(a.user.course) || a.user.role, countryName(a.user.country)].filter(Boolean).join(' · ')} · joined ${timeAgo(a.user.createdAt)}` : 'Account deleted'}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap rounded-[12px] bg-surface-2 p-3 text-[13px]">{a.about}</p>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                    {a.phone && <a href={`tel:${a.phone.replace(/[^\d+]/g, '')}`} className="text-link hover:underline">{a.phone}</a>}
                    {a.website && <a href={a.website} target="_blank" rel="noreferrer noopener" className="text-link hover:underline">{a.website}</a>}
                    <span className="muted">Applied {timeAgo(a.createdAt)} · accepted the hosting terms</span>
                    {status !== 'pending' && <span className="muted">{plural(a.published, 'quiz', 'quizzes')} published</span>}
                    {a.decidedAt && <span className="muted">{a.status === 'approved' ? 'Approved' : 'Rejected'} {timeAgo(a.decidedAt)}{a.decidedBy?.name ? ` by ${a.decidedBy.name}` : ''}{a.note ? ` · "${a.note}"` : ''}</span>}
                  </p>
                </div>
              </div>
              {a.user && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {status !== 'approved' && (
                    <button className="btn-primary py-1.5" disabled={decide.isPending} onClick={() => decide.mutate({ id: a._id, status: 'approved' })}>
                      <Check className="h-4 w-4" /> Approve
                    </button>
                  )}
                  {status !== 'rejected' && (
                    <>
                      <input
                        className="input min-w-0 flex-1 py-1.5 text-[13px] sm:max-w-xs"
                        placeholder="Reason (optional, sent to them)"
                        maxLength={300}
                        value={notes[a._id] ?? ''}
                        onChange={(e) => setNotes((n) => ({ ...n, [a._id]: e.target.value }))}
                      />
                      <button
                        className="btn-secondary py-1.5 text-danger"
                        disabled={decide.isPending}
                        onClick={() =>
                          (status === 'pending' || window.confirm(`Stop ${a.orgName} from conducting quizzes? Tests already published stay up.`)) &&
                          decide.mutate({ id: a._id, status: 'rejected', note: notes[a._id] ?? '' })
                        }
                      >
                        <X className="h-4 w-4" /> {status === 'approved' ? 'Remove hosting' : 'Reject'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Stat({ label, value, sub }) {
  return (
    // a stat: big tabular number over a small uppercase label (no box; the row is divided by hairlines)
    <div className="px-3 py-3 first:pl-0">
      <p className="ds-eyebrow">{label}</p>
      <p className="ds-num text-[28px] font-medium leading-8 tracking-[-0.015em]">{value}</p>
      {sub && <p className="muted ds-num text-[12px]">{sub}</p>}
    </div>
  );
}

/** "Official account" switch: official Tectum accounts show an Official badge instead of a role. */
function OfficialToggle({ user }) {
  const qc = useQueryClient();
  const set = useMutation({
    mutationFn: (official) => api.put(`/admin/members/${user._id}/official`, { official }).then((r) => r.data.user),
    onSuccess: (u) => {
      qc.invalidateQueries({ queryKey: ['admin', 'members'] });
      toast(u.isOfficial ? `${u.name} is now an official account` : `${u.name} is no longer an official account`);
    },
    onError: (e) => toast(e.message, 'error'),
  });
  return (
    <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold">
      <input type="checkbox" checked={!!user.isOfficial} disabled={set.isPending} onChange={(e) => set.mutate(e.target.checked)} />
      Official account
    </label>
  );
}

/**
 * Block a member from taking tests (site admins only - organizers can't, and disqualifications
 * never do it by themselves). Shows how many times they were disqualified.
 */
function QuizBanToggle({ user }) {
  const qc = useQueryClient();
  const set = useMutation({
    mutationFn: (banned) => api.put(`/admin/users/${user._id}/quiz-ban`, { banned }).then((r) => r.data.quizBanned),
    onSuccess: (banned) => {
      qc.invalidateQueries({ queryKey: ['admin', 'members'] });
      toast(banned ? `${user.name} can no longer take tests` : `${user.name} can take tests again`);
    },
    onError: (e) => toast(e.message, 'error'),
  });
  return (
    <label className={cn('mt-1 inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold', user.quizBanned && 'text-danger')}>
      <input type="checkbox" checked={!!user.quizBanned} disabled={set.isPending} onChange={(e) => set.mutate(e.target.checked)} />
      Blocked from tests{user.quizFlags ? ` (${user.quizFlags} DQ)` : ''}
    </label>
  );
}

/** Demo accounts only: step into it to edit anything with the normal screens. */
function UseDemoButton({ user }) {
  const use = useUseDemoAccount();
  return (
    <button className="btn-secondary mt-1 min-h-8 px-3 py-1 text-[12px]" disabled={use.isPending} onClick={() => use.mutate(user._id)}>
      <UserCog className="h-3.5 w-3.5" /> {use.isPending ? 'Switching…' : 'Use this account'}
    </button>
  );
}

/** Site-wide switch: keep demo accounts out of Top Contributors and Who to follow (they stay on the site). */
function HideDemoSwitch({ hidden }) {
  const qc = useQueryClient();
  const set = useMutation({
    mutationFn: (value) => api.put('/admin/settings/hide-demo', { hidden: value }).then((r) => r.data.hidden),
    onSuccess: (h) => {
      qc.invalidateQueries({ queryKey: ['admin', 'members'] });
      qc.invalidateQueries({ queryKey: ['suggestions'] });
      qc.invalidateQueries({ queryKey: ['ward'] });
      qc.invalidateQueries({ queryKey: ['user'] });
      toast(h ? 'Demo accounts are now hidden from Top Contributors and Who to follow' : 'Demo accounts are shown in Top Contributors and Who to follow again');
    },
    onError: (e) => toast(e.message, 'error'),
  });
  return (
    <div className="rounded-ds-md border border-line px-4 py-3">
      <Toggle
        checked={set.isPending ? set.variables : hidden}
        onChange={(v) => set.mutate(v)}
        label="Hide demo accounts from Top Contributors and Who to follow"
        description="Their posts, cases and profiles stay on the site; they just stop being ranked or suggested (and lose their Top Contributor badges). Turn off to show them again."
      />
    </div>
  );
}

const WHO = [
  ['all', 'All'],
  ['real', 'Real members'],
  ['demo', 'Demo accounts'],
];

function Members() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [who, setWho] = useState('all');
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin', 'members', q, who],
    queryFn: () => api.get('/admin/members', { params: { q, who } }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  if (isPending) return <PageLoader />;
  if (isError) return <ErrorState error={error} />;
  const { stats, members, photos, hideDemo } = data;

  return (
    <div className="space-y-5 px-4 py-4 sm:px-5">
      <div className="grid grid-cols-2 border-y border-line sm:grid-cols-4 sm:divide-x sm:divide-line">
        <Stat label="Members" value={stats.total} sub={`+${stats.newToday} today · +${stats.newWeek} this week${stats.demo ? ` · ${stats.demo} demo` : ''}`} />
        <Stat label="Active today" value={stats.activeToday} sub={`${stats.activeWeek} this week`} />
        <Stat label="Posts" value={stats.posts} sub={`+${stats.postsToday} today`} />
        <Stat label="Posts with photos" value={stats.photoPosts} />
      </div>

      {stats.demo > 0 && <HideDemoSwitch hidden={!!hideDemo} />}

      {photos.length > 0 && (
        <section>
          <h2 className="font-editorial font-medium mb-2 text-[13px]">Latest photos</h2>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {photos.map((p) => (
              <Link key={p._id} to={`/post/${p._id}`} className="group relative aspect-square overflow-hidden rounded-[12px] bg-surface-2">
                <img src={cldUrl(p.images[0], { w: 160, h: 160, gravity: 'auto' })} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[12px] text-white">
                  {p.author?.name ?? 'Deleted'} · {timeAgo(p.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <form
          className="mb-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(search.trim());
          }}
        >
          <input className="input flex-1" placeholder="Search members by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn-secondary">Search</button>
        </form>
        {stats.demo > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Show">
            {WHO.map(([id, label]) => (
              <button
                key={id}
                aria-pressed={who === id}
                onClick={() => setWho(id)}
                className={cn('chip min-h-9 px-3 text-[13px]', who === id ? 'border-link bg-ds-brand-soft text-link' : 'bg-surface hover:bg-surface-2')}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {!members.length ? (
          <EmptyState icon={Users} title="No members found" />
        ) : (
          <ul>
            {members.map((u) => (
              <li key={u._id} className="flex flex-wrap items-center gap-3 border-b border-line py-3 last:border-0">
                <Avatar user={u} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                    <Link to={`/profile/${u._id}`} className="truncate hover:underline">{u.name}</Link>
                    <VerificationBadge user={u} />
                    {u.isAdmin && <span className="rounded-full bg-ds-brand/10 px-1.5 text-[12px] text-link">Admin</span>}
                    {u.isDemo && <span className="rounded-full bg-ds-accent-soft px-1.5 text-[12px] text-ds-accent-text">Demo</span>}
                    {u.quizHost === 'approved' && <span className="rounded-full bg-success-soft px-1.5 text-[12px] text-success">Quiz host</span>}
                    {u.quizHost === 'pending' && <span className="rounded-full bg-warning-soft px-1.5 text-[12px] text-warning">Host request</span>}
                    {u.deactivatedAt && <span className="muted text-[12px]">(deactivated)</span>}
                  </p>
                  <p className="muted truncate text-[12px]">
                    {u.username && `@${u.username} · `}
                    {u.email} · {[courseLabel(u.course) || u.role, countryName(u.country)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="text-right text-[12px]">
                  <p>Joined {timeAgo(u.createdAt)} · {u.postCount} post{u.postCount !== 1 ? 's' : ''}</p>
                  <p className="muted">
                    {u.lastActiveAt ? `Last active ${timeAgo(u.lastActiveAt)}` : 'Not active since tracking began'}
                    {u.lastLoginAt && ` · logged in ${timeAgo(u.lastLoginAt)}`}
                  </p>
                  {u.isDemo ? <UseDemoButton user={u} /> : <OfficialToggle user={u} />}
                  {!u.isDemo && (
                    <div>
                      <QuizBanToggle user={u} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const SUPPORT_LABELS = {
  bug: 'Something is broken',
  account: 'Account or login',
  payment: 'Blue tick',
  verification: 'Verification / document',
  content: 'A post or comment',
  other: 'Something else',
};

function HelpRequests() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('open');
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin', 'support', status],
    queryFn: () => api.get('/admin/support', { params: { status } }).then((r) => r.data.tickets),
  });
  const resolve = useMutation({
    mutationFn: (id) => api.post(`/admin/support/${id}/resolve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'support'] });
      toast('Marked as resolved');
    },
    onError: (e) => toast(e.message, 'error'),
  });

  return (
    <>
      <div className="flex gap-2 border-b border-line-strong px-4 py-3 sm:px-5">
        {[['open', 'Open'], ['resolved', 'Resolved']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setStatus(id)}
            className={cn('rounded-full px-3 py-1.5 text-[12px] font-semibold', status === id ? 'bg-ds-brand text-white' : 'bg-surface-2')}
          >
            {label}
          </button>
        ))}
      </div>
      {isPending ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState error={error} />
      ) : !data.length ? (
        <EmptyState icon={LifeBuoy} title={status === 'open' ? 'No open help requests' : 'No resolved requests yet'} />
      ) : (
        <ul>
          {data.map((t) => (
            <li key={t._id} className="border-b border-line-strong px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar user={t.user} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">
                    {t.user ? <Link to={`/profile/${t.user._id}`} className="hover:underline">{t.user.name}</Link> : 'Deleted account'}
                    <span className="muted font-normal"> · {SUPPORT_LABELS[t.category] ?? t.category} · {timeAgo(t.createdAt)}</span>
                  </p>
                  {t.user?.email && (
                    <a href={`mailto:${t.user.email}?subject=${encodeURIComponent('Tectum support: ' + (SUPPORT_LABELS[t.category] ?? ''))}`} className="text-[12px] text-link hover:underline">
                      Reply by email ({t.user.email})
                    </a>
                  )}
                </div>
                {t.status === 'open' && (
                  <button className="btn-secondary py-1.5" onClick={() => resolve.mutate(t._id)}>
                    <Check className="h-4 w-4" /> Resolved
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap rounded-[12px] bg-surface-2 p-3 text-[13px]">{t.message}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function Admin() {
  const me = useAuthStore((s) => s.user);
  const [tab, setTab] = useState('members');
  if (!me?.isAdmin) return <Navigate to="/home" replace />;

  return (
    <PageShell
      wide
      title="Moderation"
      subtitle="Members, reports, verifications, quiz hosts, help requests and ads"
      tabs={
        <div role="tablist" className="flex overflow-x-auto">
          {[['members', 'Members'], ['reports', 'Reported'], ['verifications', 'Verifications'], ['hosts', 'Quiz hosts'], ['help', 'Help requests'], ['ads', 'Ads']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('tab flex-1 shrink-0 whitespace-nowrap', tab === id && 'tab-active')}>
              {label}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'members' ? <Members /> : tab === 'reports' ? <Reports /> : tab === 'verifications' ? <Verifications /> : tab === 'hosts' ? <QuizHosts /> : tab === 'ads' ? <AdsManager /> : <HelpRequests />}
    </PageShell>
  );
}
