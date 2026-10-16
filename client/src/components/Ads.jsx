import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { api, assetUrl } from '../api/client';
import { cn } from '../lib/format';
import { useAuthStore } from '../store/auth';
import { hasBlueTick } from './VerificationBadge';

/** Live ads for a placement. Fetched once per few minutes so views aren't over-counted. */
export function useAds(placement, count = 1, enabled = true) {
  // Blue tick members see no ads at all (the server also returns none for them).
  const adFree = hasBlueTick(useAuthStore((s) => s.user));
  const { data } = useQuery({
    queryKey: ['ads', placement, count],
    enabled: enabled && !adFree,
    queryFn: () => api.get('/ads', { params: { placement, count } }).then((r) => r.data.ads),
    staleTime: 5 * 60_000,
    retry: false,
  });
  return adFree ? [] : data ?? [];
}

/** How often feed ads appear: after every `feedEvery` posts (0 = none). Set by admins. */
export function useAdSettings() {
  const { data } = useQuery({
    queryKey: ['ads', 'settings'],
    queryFn: () => api.get('/ads/settings').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  return data ?? { feedEvery: 5 };
}

// Local previews (blob: URLs from the ad form) are used as-is.
const adImage = (url) => (url.startsWith('blob:') ? url : assetUrl(url));

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** Opens the advertiser's link in a new tab and counts the click. */
function AdLink({ ad, className, children, ...props }) {
  return (
    <a
      href={ad.linkUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => api.post(`/ads/${ad._id}/click`).catch(() => {})}
      className={className}
      {...props}
    >
      {children}
    </a>
  );
}

/** Compact, clearly labelled ad in the right panel (a small thumbnail beside the text). */
export function SponsoredRailCard() {
  const [ad] = useAds('rail');
  if (!ad) return null;
  return (
    <section className="card p-3" aria-label="Sponsored">
      <p className="mb-2 flex items-center justify-between text-[12px] font-semibold uppercase tracking-wide text-ds-fg-3">
        <span className="rounded bg-surface-2 px-1.5 py-0.5">Sponsored</span>
        <span className="truncate pl-2 normal-case tracking-normal">{ad.advertiser}</span>
      </p>
      <AdLink ad={ad} className="group flex gap-3">
        {ad.imageUrl && <img src={adImage(ad.imageUrl)} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-[6px] object-cover" />}
        <span className="min-w-0">
          <span className="line-clamp-2 block text-[13px] font-semibold leading-snug group-hover:underline">{ad.title}</span>
          {ad.body && <span className="muted mt-0.5 line-clamp-2 block text-[12px] leading-4">{ad.body}</span>}
          <span className="mt-1 inline-block text-[12px] font-semibold text-link">{ad.cta || 'Learn more'} →</span>
        </span>
      </AdLink>
    </section>
  );
}

/** "Promoted" item between feed posts, laid out like a post. */
export function SponsoredFeedItem({ ad, className }) {
  if (!ad) return null;
  const initial = ad.advertiser?.[0]?.toUpperCase() ?? 'A';
  return (
    <article className={cn('flex gap-3 px-4 pb-3 pt-3', className)} aria-label={`Promoted by ${ad.advertiser}`}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[13px] font-semibold text-ds-fg-2">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[15px] leading-5">
          <span className="truncate font-semibold">{ad.advertiser}</span>
          <span className="muted truncate">· {hostOf(ad.linkUrl)}</span>
        </p>
        <p className="mt-1 text-[15px] font-semibold leading-snug">{ad.title}</p>
        {ad.body && <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-5">{ad.body}</p>}
        <AdLink ad={ad} className="mt-3 block overflow-hidden rounded-[12px] border border-line transition hover:bg-surface-2">
          {ad.imageUrl && <img src={adImage(ad.imageUrl)} alt="" loading="lazy" className="max-h-80 w-full object-cover" />}
          <span className="flex items-center justify-between gap-3 px-3 py-2.5 text-[15px]">
            <span className="muted truncate">{hostOf(ad.linkUrl)}</span>
            <span className="inline-flex shrink-0 items-center gap-1 font-semibold">
              {ad.cta || 'Learn more'} <ExternalLink className="h-4 w-4" />
            </span>
          </span>
        </AdLink>
        <p className="muted mt-2 text-[13px]">Promoted by {ad.advertiser} · Ad</p>
      </div>
    </article>
  );
}
