import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Sparkles, Search, X, UserPlus, BadgeCheck, ChevronRight } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useUIStore, toast } from '../store/ui';
import TagInput from '../components/TagInput';
import SpecialtyTagChip from '../components/SpecialtyTagChip';
import { PageShell } from '../components/Layout';
import InfiniteFeed from '../components/InfiniteFeed';
import { useAdSettings } from '../components/Ads';
import SearchSuggest from '../components/SearchSuggest';
import { hasBlueTick } from '../components/VerificationBadge';
import { EmptyState, ScrollRow } from '../components/ui';
import { prettyTag } from '../lib/constants';
import { slugsForCourse } from '../lib/specialties';
import { cn } from '../lib/format';
import { CollabIcon } from '../components/ds/icons';

// The whole community's posts. (Home is the study dashboard; this is its "See all".)
const TABS = [
  { id: 'foryou', label: 'For you', icon: Sparkles, params: {} },
  { id: 'following', label: 'Following', icon: Users, params: { following: true } },
  { id: 'search', label: 'Search', icon: Search, params: { sort: 'recent' } },
];

const EMPTY = {
  foryou: { icon: Sparkles, title: 'Welcome to Tectum', text: 'Be the first to share a pearl, a case or a question.', cta: 'compose' },
  following: { icon: UserPlus, title: "You're not following anyone yet", text: 'Follow colleagues and classmates to fill this feed with their posts.', cta: 'people' },
  search: { icon: Search, title: 'No posts match your search', text: 'Try another word, a topic like "ECG", or a colleague\'s name in the box above.', cta: 'people' },
};

const DISMISS_KEY = 'tectum-hide-profile-checklist';

// ---------------- blue tick members: overview + specialties, always open ----------------
function ProfessionalProfileEditor({ me }) {
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();
  const [bio, setBio] = useState(me.bio || '');
  const [tags, setTags] = useState(me.specialtyTags || []);
  const dirty = bio !== (me.bio || '') || JSON.stringify(tags) !== JSON.stringify(me.specialtyTags || []);
  const suggestions = slugsForCourse(me?.course).filter((s) => !tags.includes(s)).slice(0, 10);

  const save = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('bio', bio.trim());
      fd.append('specialtyTags', JSON.stringify(tags));
      return api.put(`/users/${me._id}`, fd).then((r) => r.data.user);
    },
    onSuccess: (u) => {
      setUser(u);
      qc.invalidateQueries({ queryKey: ['user', me._id] });
      qc.invalidateQueries({ queryKey: ['suggestions'] });
      toast('Professional profile saved');
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const done = [Boolean(me.bio?.trim()), me.specialtyTags?.length > 0].filter(Boolean).length;

  return (
    <section className="card p-4">
      <div className="flex items-start gap-3">
        <BadgeCheck className="mt-1 h-5 w-5 shrink-0 fill-tick text-ds-surface" />
        <div className="min-w-0 flex-1">
          <h2 className="font-editorial text-[20px] font-medium leading-[26px]">Your professional profile</h2>
          <p className="muted ds-num mt-0.5 text-[13px] leading-[18px]">
            As a Verified member, keep these up to date. They help colleagues find and trust you. {done}/2 complete.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label className="label" htmlFor="home-bio">Professional overview</label>
          <textarea
            id="home-bio"
            className="input"
            rows={3}
            maxLength={500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="e.g. Interventional cardiology fellow at City General. Interested in ECG teaching and structural heart disease."
          />
          <p className="muted ds-num mt-1 text-right text-[12px]">{bio.length}/500</p>
        </div>

        <div>
          <label className="label">Your specialties</label>
          <TagInput value={tags} onChange={setTags} max={12} placeholder="Type a specialty and press Enter" />
          {suggestions.length > 0 && tags.length < 12 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <SpecialtyTagChip key={s} tag={s} onToggle={() => setTags((t) => [...t, s].slice(0, 12))} />
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button className="btn-primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------- profile checklist ----------------
function ProfileChecklist() {
  const me = useAuthStore((s) => s.user);
  // Blue tick members get the two key fields open for editing, always visible.
  if (me && hasBlueTick(me)) return <ProfessionalProfileEditor key={me._id} me={me} />;
  return <ProfileChecklistSteps me={me} />;
}

function ProfileChecklistSteps({ me }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (!me || hidden) return null;

  const steps = [
    { done: Boolean(me.profilePicture), label: 'Add a profile photo', to: '/settings' },
    { done: Boolean(me.bio?.trim()), label: 'Write your professional overview', to: '/settings' },
    { done: me.specialtyTags?.length > 0, label: 'Choose your specialties', to: '/settings' },
    { done: me.verificationStatus !== 'unverified', label: me.verificationStatus === 'pending' ? 'Verification under review' : 'Get verified (blue tick)', to: '/settings?section=verification' },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <section className="card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px]">
          <span className="font-semibold">Finish your profile</span>{' '}
          <span className="muted ds-num">· {done} of {steps.length} done</span>
        </p>
        <button onClick={dismiss} className="-mr-2 rounded-full p-1.5 text-ds-fg-3 hover:bg-surface-2 hover:text-ink" aria-label="Hide checklist">
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
      <ul className="mt-2 flex flex-wrap gap-2">
        {steps
          .filter((s) => !s.done)
          .map((s) => (
            <li key={s.label}>
              <Link to={s.to} className="inline-flex items-center gap-1 rounded-full border border-line-strong px-3 py-1.5 text-[13px] font-medium transition hover:bg-surface-2">
                {s.label} <ChevronRight className="h-4 w-4 text-ds-fg-3" strokeWidth={1.5} />
              </Link>
            </li>
          ))}
      </ul>
    </section>
  );
}

// ---------------- page ----------------
export default function Feed() {
  const me = useAuthStore((s) => s.user);
  const openComposer = useUIStore((s) => s.openComposer);
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tab = TABS.find((t) => t.id === params.get('tab')) ?? TABS[0];
  const specialty = params.get('specialty') || '';
  // Collaboration (only posts open for academic collaboration) lives at /collaboration.
  const collab = pathname.startsWith('/collaboration');
  // Old /feed?collab=1 links move to the new address.
  useEffect(() => {
    if (!collab && params.get('collab') === '1') {
      const next = new URLSearchParams(params);
      next.delete('collab');
      navigate({ pathname: '/collaboration', search: next.toString() }, { replace: true });
    }
  }, [collab, params, navigate]);
  const toggleCollab = () => {
    const next = new URLSearchParams(params);
    next.delete('collab');
    navigate({ pathname: collab ? '/feed' : '/collaboration', search: next.toString() }, { replace: true });
  };
  const q = tab.id === 'search' ? params.get('q') || '' : ''; // Search tab: words the posts must contain
  const [text, setText] = useState(q);
  const [showAll, setShowAll] = useState(false);
  const { feedEvery } = useAdSettings(); // admins choose this in Moderation > Ads

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const queryParams = { ...tab.params, ...(specialty ? { specialty } : {}), ...(collab ? { collab: true } : {}), ...(q ? { q } : {}) };
  const empty = EMPTY[tab.id];
  const mine = me?.specialtyTags ?? [];
  // subject chips: my own first, then my course's Wards, then everything else (Show all)
  const ordered = slugsForCourse(me?.course);
  const chips = showAll ? [...new Set([...mine, ...ordered])] : [...new Set([...mine, ...ordered.slice(0, Math.max(0, 8 - mine.length))])];
  if (specialty && !chips.includes(specialty)) chips.unshift(specialty);

  const emptyAction =
    empty.cta === 'people' ? (
      <Link to="/discover?tab=specialists" className="btn-primary"><UserPlus className="h-4 w-4" /> Find people to follow</Link>
    ) : (
      <button className="btn-primary" onClick={() => openComposer(empty.cta === 'case' ? 'case_study' : 'text')}>
        {empty.cta === 'case' ? 'Share a case' : 'Create a post'}
      </button>
    );

  return (
    <PageShell
      cards
      title={collab ? 'Collaboration' : 'Community'}
      subtitle={collab ? 'Posts looking for co-researchers or student collaborators' : 'Everything shared on Tectum'}
      tabs={
        <div role="tablist" className="no-scrollbar flex overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === tab.id}
              onClick={() => {
                setText('');
                update({ tab: t.id === 'foryou' ? '' : t.id, q: '' });
              }}
              className={cn('tab flex flex-1 items-center justify-center gap-1.5', t.id === tab.id && 'tab-active')}
            >
              <t.icon className="h-4 w-4" strokeWidth={1.5} />
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-3">
        {tab.id === 'search' ? (
          <div className="card p-3">
            <SearchSuggest
              autoFocus
              value={text}
              onChange={(v) => {
                setText(v);
                if (!v.trim()) update({ q: '' });
              }}
              onSubmit={() => update({ q: text.trim() })}
              placeholder="Search people, topics or posts to collaborate on"
            />
            <p className="muted mt-2 px-1 text-[13px]">
              Pick a person to open their profile and follow or message them, or press Enter to see matching posts.
              Turn on Collaboration open to see only posts looking for collaborators.
            </p>
          </div>
        ) : (
          <ProfileChecklist />
        )}

        {/* collaboration + specialty filters */}
        <ScrollRow className="flex items-center gap-2 py-0.5" label="Filters">
          <button
            onClick={toggleCollab}
            aria-pressed={collab}
            className={cn(
              'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition active:scale-[0.98]',
              collab ? 'border-link bg-ds-brand-soft text-link' : 'border-line-strong bg-surface text-ds-fg-2 hover:bg-surface-2 hover:text-ink'
            )}
          >
            <CollabIcon size={16} /> Collaboration open
          </button>
          <span className="h-6 w-px shrink-0 bg-line" aria-hidden="true" />
          {['', ...chips].map((s) => {
            const active = specialty === s;
            return (
              <button
                key={s || 'all'}
                onClick={() => update({ specialty: s && specialty === s ? '' : s })}
                aria-pressed={active}
                className={cn(
                  'min-h-9 shrink-0 rounded-full border px-3 text-[13px] font-medium capitalize transition active:scale-[0.98]',
                  active ? 'border-link bg-ds-brand-soft text-link' : 'border-line-strong bg-surface text-ds-fg-2 hover:bg-surface-2 hover:text-ink'
                )}
              >
                {s ? prettyTag(s) : 'All specialties'}
              </button>
            );
          })}
          <button onClick={() => setShowAll((v) => !v)} className="shrink-0 px-1 text-[13px] font-medium text-link hover:underline">
            {showAll ? 'Show less' : 'More'}
          </button>
        </ScrollRow>

        {(() => {
          const emptyState = (
            <EmptyState
              icon={empty.icon}
              title={q ? `No posts match "${q}"` : collab ? 'No open collaborations here yet' : specialty ? `No posts in ${prettyTag(specialty)} yet` : empty.title}
              action={collab ? <button className="btn-secondary" onClick={toggleCollab}>Show all posts</button> : specialty ? <button className="btn-secondary" onClick={() => update({ specialty: '' })}>Show all specialties</button> : emptyAction}
            >
              {collab ? 'Start one: when you create a post, choose "Looking for co-researchers" or "Open for student collaboration".' : empty.text}
            </EmptyState>
          );
          return (
            <InfiniteFeed
              key={`${tab.id}-${specialty}-${collab}-${q}`}
              variant="cards"
              queryKey={['posts', 'feed', tab.id, specialty, collab, q]}
              params={queryParams}
              adsEvery={feedEvery}
              empty={emptyState}
            />
          );
        })()}
      </div>
    </PageShell>
  );
}
