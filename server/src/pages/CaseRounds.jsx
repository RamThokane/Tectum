import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CircleCheck, Circle, MessageCircle, BarChart3, Stethoscope, Plus, FileQuestion, SlidersHorizontal, Image as ImageIcon } from 'lucide-react';
import { api } from '../api/client';
import { cldUrl } from '../lib/cldUrl';
import { useUIStore } from '../store/ui';
import { PageShell } from '../components/Layout';
import { usePostFeed, useAutoLoadMore } from '../components/InfiniteFeed';
import { AuthorLine, SpecialtyPill, Hashtags, TypeBadge } from '../components/PostCard';
import CaseCard from '../components/CaseCard';
import { CollabPill, CollabAction } from '../components/Collab';
import PostActions from '../components/PostActions';
import PostMenu from '../components/PostMenu';
import CommentThread from '../components/CommentThread';
import { replyNote } from '../components/ReplyPolicy';
import { EmptyState, ErrorState, Spinner, Skeleton, CardSkeleton, Chip, Modal } from '../components/ui';
import NotFoundState from '../components/NotFoundState';
import { ageSexLabel } from '../lib/constants';
import { specialtyMeta, wardOf, wardsByGroup } from '../lib/specialties';
import { useAuthStore } from '../store/auth';
import { cn, timeAgo, pluralize } from '../lib/format';
import { prefetchProps } from '../lib/routes';
import { SpecialtyDot } from '../components/ds/display';

/** One case in the list: serif title, specialty dot + name, age/sex, solved state, thumbnail, counts. */
function CaseRow({ post, active, to }) {
  const cs = post.caseStudy ?? {};
  const ward = wardOf(post);
  const m = ward ? specialtyMeta(ward) : null;
  const votes = post.poll?.total ?? 0;
  const thumb = post.images?.[0];
  const counts = [
    post.commentCount > 0 && { icon: MessageCircle, text: `${pluralize(post.commentCount, 'answer')}` },
    votes > 0 && { icon: BarChart3, text: `${pluralize(votes, 'vote')}` },
  ].filter(Boolean);
  return (
    <Link
      to={to}
      {...prefetchProps(to)}
      aria-current={active ? 'page' : undefined}
      className={cn('card card-hover relative block overflow-hidden p-3.5', active && 'border-link! bg-ds-brand-soft!')}
    >
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          {/* specialty dot + name, then the case title in the serif */}
          {m && (
            <p className="ds-eyebrow mb-1 flex items-center gap-1.5">
              <SpecialtyDot hue={m.hue} /> <span className="truncate">{m.short ?? m.label}</span>
            </p>
          )}
          <p className="line-clamp-2 font-editorial text-[17px] font-medium leading-[23px]">{post.title || cs.chiefComplaint}</p>
          <div className="muted ds-num mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            {post.solved ? (
              <span className="flex items-center gap-1 font-medium text-success"><CircleCheck className="h-3.5 w-3.5" strokeWidth={1.75} /> Solved</span>
            ) : (
              <span className="flex items-center gap-1"><Circle className="h-3.5 w-3.5" strokeWidth={1.5} /> Unsolved</span>
            )}
            {ageSexLabel(cs, { short: true }) && <span className="font-code">{ageSexLabel(cs, { short: true })}</span>}
            {counts.map((c) => (
              <span key={c.text} className="flex items-center gap-1"><c.icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {c.text}</span>
            ))}
            {!counts.length && <span className="font-medium text-link">Be the first to answer</span>}
            <span className="ml-auto">{timeAgo(post.createdAt)}</span>
          </div>
        </div>
        {thumb && (
          <img src={cldUrl(thumb, { w: 64, h: 64, gravity: 'auto' })} width={64} height={64} alt="" loading="lazy" decoding="async" className="h-16 w-16 shrink-0 rounded-[12px] border border-line object-cover" />
        )}
      </div>
    </Link>
  );
}

const SORTS = [
  ['recent', 'Newest'],
  ['discussed', 'Most discussed'],
  ['ranked', 'Trending'],
];

/** The filter controls themselves (used inline on desktop and in a bottom sheet on phones). */
function FilterFields({ params, update }) {
  const course = useAuthStore((s) => s.user?.course);
  const get = (k) => params.get(k) || '';
  const toggle = (k) => update({ [k]: get(k) === '1' ? '' : '1' });
  const seg = (key, opts) => (
    <div className="segmented" role="radiogroup">
      {opts.map(([v, l]) => (
        <button key={v || 'all'} type="button" role="radio" aria-checked={get(key) === v} onClick={() => update({ [key]: v })} className={cn('segment', get(key) === v && 'segment-active')}>
          {l}
        </button>
      ))}
    </div>
  );
  const check = (key, label, Icon) => (
    <button
      type="button"
      onClick={() => toggle(key)}
      aria-pressed={get(key) === '1'}
      className={cn('chip min-h-9 px-3 text-[13px] transition-colors active:scale-[0.98]', get(key) === '1' ? 'border-link bg-ds-brand-soft text-link' : 'text-ds-fg-2 hover:bg-surface-2')}
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} /> {label}
    </button>
  );
  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor="cr-specialty">Specialty</label>
        <select id="cr-specialty" value={get('ward')} onChange={(e) => update({ ward: e.target.value })} className="input py-2.5">
          <option value="">All specialties</option>
          {wardsByGroup(course).map((g) => (
            <optgroup key={g.id} label={g.label}>
              {g.wards.map((w) => <option key={w.slug} value={w.slug}>{w.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {check('unsolved', 'Unsolved only', Circle)}
        {check('image', 'Has image', ImageIcon)}
      </div>
      <div>
        <p className="label">Sort by</p>
        {seg('sort', SORTS.map(([v, l]) => [v === 'recent' ? '' : v, l]))}
      </div>
    </div>
  );
}

/** Desktop: filters above the list. Phones: a "Filters" button opening a bottom sheet. */
function Filters({ params, update }) {
  const [open, setOpen] = useState(false);
  const active = ['ward', 'unsolved', 'image', 'sort'].filter((k) => params.get(k)).length;
  return (
    <>
      <div className="hidden lg:block">
        <FilterFields params={params} update={update} />
      </div>
      <div className="flex items-center gap-2 lg:hidden">
        <button className="btn-secondary" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} /> Filters{active ? ` · ${active}` : ''}
        </button>
        {active > 0 && (
          <button className="btn-ghost text-[13px]" onClick={() => update({ ward: '', unsolved: '', image: '', sort: '' })}>
            Clear
          </button>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Filter cases" footer={<button className="btn-primary w-full" onClick={() => setOpen(false)}>Show cases</button>}>
        <div className="p-5">
          <FilterFields params={params} update={update} />
        </div>
      </Modal>
    </>
  );
}

function CaseListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="card space-y-2 p-3.5" aria-hidden="true">
          <Skeleton className="h-4 w-4/5" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** The selected case in full: sections, poll + reveal, teaching points, then the discussion. */
function CaseDetail({ id, onBack }) {
  const navigate = useNavigate();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['post', id],
    queryFn: () => api.get(`/posts/${id}`).then((r) => r.data),
  });

  if (isPending) return <CardSkeleton lines={8} />;
  if (isError || !data?.post) {
    return (
      <div className="card">
        {[400, 404].includes(error?.response?.status) ? (
          <NotFoundState icon={FileQuestion} title="This case doesn't exist">It may have been deleted by its author.</NotFoundState>
        ) : (
          <ErrorState error={error} onRetry={refetch} />
        )}
      </div>
    );
  }
  const { post, comments } = data;
  return (
    <article className="card overflow-clip">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 lg:hidden">
        <button onClick={onBack} className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[13px] font-medium text-ds-fg-3 hover:bg-surface-2 hover:text-ink">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> All cases
        </button>
      </div>
      <div className="px-4 pb-1 pt-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <AuthorLine user={post.author} date={post.createdAt} size="md" />
          <div className="-mr-2"><PostMenu post={post} onDeleted={() => navigate('/cases', { replace: true })} /></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <TypeBadge post={post} />
          <SpecialtyPill tag={wardOf(post) ?? post.tags?.[0]} />
          <CollabPill post={post} />
          {ageSexLabel(post.caseStudy) && <Chip>{ageSexLabel(post.caseStudy)}</Chip>}
          {post.solved && <Chip tone="success" icon={CircleCheck}>Solved</Chip>}
        </div>
        <CaseCard key={post._id} post={post} full className="mt-2" />
        <Hashtags tags={post.tags} className="mt-3" />
        <CollabAction post={post} className="mt-3" />
        <div className="mt-2 border-t border-line py-1">
          <PostActions post={post} />
        </div>
      </div>
      <div className="border-t border-line">
        <h2 className="px-4 pt-4 font-editorial text-[20px] font-medium leading-[26px] sm:px-5">Discussion</h2>
        <CommentThread postId={post._id} comments={comments} canReply={post.canReply !== false} replyNote={replyNote(post)} />
      </div>
    </article>
  );
}

/**
 * Case Rounds: the case list on the left, the chosen case on the right. On phones the list and
 * the case are separate screens (/cases and /cases/:id), and the filters open in a bottom sheet.
 */
export default function CaseRounds() {
  const { id } = useParams();
  // The open case (same query as its detail pane, so no extra request) names the tab.
  const { data: chosen } = useQuery({ queryKey: ['post', id], queryFn: () => api.get(`/posts/${id}`).then((r) => r.data), enabled: Boolean(id) });
  const chosenCase = chosen?.post;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openComposer = useUIStore((s) => s.openComposer);
  const ward = params.get('ward') || '';
  const unsolved = params.get('unsolved') === '1';
  const withImage = params.get('image') === '1';
  const sort = params.get('sort') || 'recent';
  const search = params.toString() ? `?${params}` : '';

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const query = usePostFeed({
    queryKey: ['posts', 'case-rounds', ward, unsolved, withImage, sort],
    params: {
      type: 'case_study',
      sort,
      ...(ward && { tag: ward }),
      ...(unsolved && { unsolved: true }),
      ...(withImage && { media: true }),
    },
    limit: 20,
  });
  const sentinel = useAutoLoadMore(query);
  const cases = query.data?.pages.flatMap((p) => p.posts) ?? [];
  // On a wide screen with nothing chosen yet, show the first case.
  const selected = id ?? cases[0]?._id;

  // Keep the chosen row in view inside the list's own scroll box (wide screens). Never scroll the
  // page itself: scrollIntoView did, so /cases/:id used to open already scrolled down.
  const listRef = useRef(null);
  useEffect(() => {
    const box = listRef.current;
    const row = box?.querySelector('[aria-current="page"]');
    if (!row || box.scrollHeight <= box.clientHeight) return;
    const top = row.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = top - (box.clientHeight - row.offsetHeight) / 2;
    }
  }, [selected]);

  const filtered = Boolean(ward || withImage);

  return (
    <PageShell
      cards
      wide="xl"
      title="Case Rounds"
      docTitle={chosenCase ? `${chosenCase.title || chosenCase.caseStudy?.chiefComplaint || 'Case'} · Case Rounds` : 'Case Rounds'}
      subtitle={ward ? `${specialtyMeta(ward).label} cases` : 'Work through real, de-identified cases'}
      actions={
        <button className="btn-primary shrink-0 px-3.5 text-[13px]" onClick={() => openComposer('case_study', { ward: ward || null })}>
          <Plus className="h-4 w-4" strokeWidth={1.75} /> New case
        </button>
      }
    >
      <div className="grid items-start gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* list pane */}
        <aside className={cn('space-y-3 lg:sticky lg:top-24', id && 'hidden lg:block')} aria-label="Cases">
          <div className="card p-3">
            <Filters params={params} update={update} />
          </div>
          <div ref={listRef} className="space-y-2 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pr-1">
            {query.isPending ? (
              <CaseListSkeleton />
            ) : query.isError ? (
              <div className="card"><ErrorState error={query.error} onRetry={query.refetch} /></div>
            ) : cases.length ? (
              <>
                {cases.map((p) => (
                  <CaseRow key={p._id} post={p} active={p._id === selected && Boolean(id)} to={`/cases/${p._id}${search}`} />
                ))}
                <div ref={sentinel} className="flex justify-center py-3">{query.isFetchingNextPage && <Spinner />}</div>
              </>
            ) : (
              <div className="card">
                <EmptyState
                  icon={Stethoscope}
                  title={unsolved && !filtered ? "You've solved every case here" : 'No cases match'}
                  action={
                    filtered || unsolved ? (
                      <button className="btn-secondary" onClick={() => update({ ward: '', unsolved: '', image: '' })}>Clear filters</button>
                    ) : (
                      <button className="btn-primary" onClick={() => openComposer('case_study')}><Plus className="h-4 w-4" /> Share a case</button>
                    )
                  }
                >
                  {unsolved && !filtered ? 'Nice work! Try another specialty or level.' : 'Try other filters, or share a case yourself.'}
                </EmptyState>
              </div>
            )}
          </div>
        </aside>

        {/* case pane */}
        <section className={cn('min-w-0', !id && 'hidden lg:block')}>
          {selected ? (
            <CaseDetail id={selected} onBack={() => navigate(`/cases${search}`)} />
          ) : query.isPending ? (
            <CardSkeleton lines={8} />
          ) : (
            <div className="card">
              <EmptyState icon={Stethoscope} title="Pick a case">Choose a case from the list to start working through it.</EmptyState>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
