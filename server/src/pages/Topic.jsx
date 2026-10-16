import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, ExternalLink, Globe, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { PageShell } from '../components/Layout';
import PostCard from '../components/PostCard';
import { FEED_SURFACE } from '../components/InfiniteFeed';
import { EmptyState, ErrorState, PageLoader } from '../components/ui';
import { useUIStore } from '../store/ui';

function SourceLink({ href, icon: Icon, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3.5 py-2 text-[12px] font-semibold transition hover:bg-ds-brand-soft hover:text-link"
    >
      <Icon className="h-4 w-4" /> {children} <ExternalLink className="h-3 w-3 opacity-60" />
    </a>
  );
}

/** Posts already on Tectum that mention this subject. */
function TectumPosts({ label }) {
  const query = useQuery({
    queryKey: ['posts', 'topic', label],
    queryFn: () => api.get('/search', { params: { q: label } }).then((r) => r.data.posts),
  });
  const posts = (query.data ?? []).slice(0, 5);
  const openComposer = useUIStore((s) => s.openComposer);

  return (
    <section>
      <h2 className="font-editorial font-medium mb-3 px-1 text-[17px]">On Tectum</h2>
      {query.isPending ? (
        <div className="card p-6"><PageLoader /></div>
      ) : posts.length ? (
        <div className={FEED_SURFACE}>
          {posts.map((p) => <PostCard key={p._id} post={p} />)}
        </div>
      ) : (
        <div className="card">
          <EmptyState icon={Sparkles} title="No posts on this yet" action={<button className="btn-primary" onClick={() => openComposer('text')}>Be the first to post</button>}>
            Share a case, a pearl or your notes on {label.toLowerCase()}.
          </EmptyState>
        </div>
      )}
    </section>
  );
}

export default function Topic() {
  const { slug } = useParams();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['topic', slug],
    queryFn: () => api.get(`/topics/${slug}`).then((r) => r.data.topic),
  });

  if (isPending) return <PageShell bare><PageLoader /></PageShell>;
  if (isError) return <PageShell bare><div className="card"><ErrorState error={error} onRetry={refetch} /></div></PageShell>;

  const t = data;
  return (
    <PageShell bare docTitle={t?.label}>
      <div className="space-y-5 px-3 pt-3 md:px-0 md:pt-0">
        <Link to="/discover" className="btn-ghost -ml-2 w-fit text-[13px]">
          <ArrowLeft className="h-4 w-4" /> Discovery
        </Link>

        <article className="card overflow-hidden">
          <div className="bg-[#0f2a5c] px-5 py-6 text-white sm:px-7">
            <p className="ds-eyebrow text-white/70!">{t.group}</p>
            <h1 className="mt-1 font-editorial text-[28px] font-medium leading-8 tracking-[-0.015em] sm:text-[40px] sm:leading-[44px]">{t.label}</h1>
          </div>

          <div className="space-y-6 px-5 py-6 sm:px-7">
            <section>
              <h2 className="ds-eyebrow">What it is</h2>
              <p className="mt-2 leading-relaxed">{t.summary}</p>
            </section>

            <section>
              <h2 className="ds-eyebrow">Key points</h2>
              <ul className="mt-2 space-y-2">
                {t.points.map((p) => (
                  <li key={p} className="flex gap-2.5 leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="ds-eyebrow">Why it's in focus</h2>
              <p className="mt-2 leading-relaxed">{t.why}</p>
            </section>

            <section>
              <h2 className="ds-eyebrow">Read more</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <SourceLink href={t.links.who} icon={Globe}>WHO</SourceLink>
                <SourceLink href={t.links.pubmed} icon={BookOpen}>PubMed research</SourceLink>              </div>
              <p className="muted mt-3 text-[12px]">
                These notes are a short educational summary written for Tectum, not medical advice and not a live news feed. Check the sources above for the current detail.
              </p>
            </section>
          </div>
        </article>

        <TectumPosts label={t.label} />
      </div>
    </PageShell>
  );
}
