import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Pause, Play, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { cldUrl } from '../lib/cldUrl';
import { toast } from '../store/ui';
import FileUploadZone from './FileUploadZone';
import { SponsoredFeedItem, useAdSettings } from './Ads';
import { EmptyState, ErrorState, PageLoader } from './ui';
import { IMAGE_ACCEPT, MAX_IMAGE_MB } from '../lib/constants';
import { cn, compact, pluralize } from '../lib/format';

const PLACEMENTS = [
  ['both', 'Side panel + feed'],
  ['rail', 'Side panel only'],
  ['feed', 'Feed only'],
];
const blank = { advertiser: '', title: '', body: '', linkUrl: 'https://', cta: 'Learn more', placement: 'both', startsAt: '', endsAt: '' };
const day = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null);

function NewAdForm({ onDone }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(blank);
  const [image, setImage] = useState([]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const create = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (image[0]) fd.append('adImage', image[0]);
      return api.post('/ads/manage', fd).then((r) => r.data.ad);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'ads'] });
      qc.invalidateQueries({ queryKey: ['ads'] });
      toast('Ad is live');
      setForm(blank);
      setImage([]);
      onDone?.();
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const field = (key, label, props = {}) => (
    <div>
      <label className="label" htmlFor={`ad-${key}`}>{label}</label>
      <input id={`ad-${key}`} className="input" value={form[key]} onChange={(e) => set({ [key]: e.target.value })} {...props} />
    </div>
  );
  // Created and revoked in one effect so a re-run never leaves the preview on a revoked blob.
  const [imagePreview, setImagePreview] = useState('');
  useEffect(() => {
    const url = image[0] ? URL.createObjectURL(image[0]) : '';
    setImagePreview(url);
    return () => url && URL.revokeObjectURL(url);
  }, [image]);
  const preview = {
    ...form,
    _id: 'preview',
    advertiser: form.advertiser || 'Advertiser',
    title: form.title || 'Your headline',
    linkUrl: form.linkUrl.length > 8 ? form.linkUrl : 'https://example.com',
    imageUrl: imagePreview,
  };

  return (
    <form
      className="grid gap-6 border-b border-line p-4 lg:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <div className="space-y-4">
        {field('advertiser', 'Advertiser (shown as "Promoted by …")', { maxLength: 80, placeholder: 'e.g. Marrow Medical', required: true })}
        {field('title', 'Headline', { maxLength: 80, placeholder: 'e.g. NEET PG mock test, free this week', required: true })}
        <div>
          <label className="label" htmlFor="ad-body">Text <span className="muted font-normal">(optional, up to 280 characters)</span></label>
          <textarea id="ad-body" className="input" rows={3} maxLength={280} value={form.body} onChange={(e) => set({ body: e.target.value })} />
        </div>
        {field('linkUrl', 'Link (where the ad goes)', { type: 'url', placeholder: 'https://', required: true })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field('cta', 'Button text', { maxLength: 24 })}
          <div>
            <label className="label" htmlFor="ad-placement">Where to show</label>
            <select id="ad-placement" className="input" value={form.placement} onChange={(e) => set({ placement: e.target.value })}>
              {PLACEMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {field('startsAt', 'Start date (optional)', { type: 'date' })}
          {field('endsAt', 'End date (optional)', { type: 'date' })}
        </div>
        <div>
          <label className="label">Image <span className="muted font-normal">(optional, wide images look best)</span></label>
          <FileUploadZone files={image} onChange={setImage} accept={IMAGE_ACCEPT} maxSizeMB={MAX_IMAGE_MB} compact label="Add an image" />
        </div>
        <p className="muted text-[13px]">
          Check the ad follows the Advertising Policy: no prescription medicines, no cure claims, nothing misleading.
        </p>
        <div className="flex gap-2">
          <button className="btn-primary" disabled={create.isPending}>{create.isPending ? 'Publishing…' : 'Publish ad'}</button>
          <button type="button" className="btn-ghost" onClick={onDone}>Cancel</button>
        </div>
      </div>
      <div>
        <p className="label">Preview in the feed</p>
        <div className="rounded-[12px] border border-line">
          <SponsoredFeedItem ad={preview} />
        </div>
      </div>
    </form>
  );
}

/** "Show a feed ad after every [N] posts" - saved for the whole site. */
function FeedFrequency() {
  const qc = useQueryClient();
  const { feedEvery } = useAdSettings();
  const [value, setValue] = useState(String(feedEvery));
  useEffect(() => setValue(String(feedEvery)), [feedEvery]);
  const n = Number(value);
  const valid = value !== '' && Number.isInteger(n) && n >= 0 && n <= 50;

  const save = useMutation({
    mutationFn: () => api.put('/ads/manage/settings', { feedEvery: n }).then((r) => r.data),
    onSuccess: (s) => {
      qc.setQueryData(['ads', 'settings'], s);
      toast(s.feedEvery ? `Feed ads now show after every ${pluralize(s.feedEvery, 'post')}` : 'Feed ads turned off');
    },
    onError: (e) => toast(e.message, 'error'),
  });

  return (
    <form
      className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) save.mutate();
      }}
    >
      <div>
        <label className="label" htmlFor="ad-every">Show a "Promoted" ad in the feed after every</label>
        <div className="flex items-center gap-2">
          <input
            id="ad-every"
            type="number"
            min={0}
            max={50}
            step={1}
            inputMode="numeric"
            className="input w-24"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <span className="text-[13px] font-semibold">posts</span>
        </div>
      </div>
      <button className="btn-primary" disabled={!valid || n === feedEvery || save.isPending}>
        {save.isPending ? 'Saving…' : 'Save'}
      </button>
      <p className="muted w-full text-[13px]">
        {!valid ? 'Enter a whole number from 0 to 50.' : n === 0 ? '0 means no ads in the feed (the side-panel ad still shows).' : `Members see ${pluralize(n, 'post')}, then 1 ad, then ${n} more, and so on.`}
      </p>
    </form>
  );
}

export default function AdsManager() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin', 'ads'],
    queryFn: () => api.get('/ads/manage').then((r) => r.data.ads),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'ads'] });
    qc.invalidateQueries({ queryKey: ['ads'] });
  };
  const update = useMutation({
    mutationFn: ({ id, ...patch }) => api.patch(`/ads/manage/${id}`, patch),
    onSuccess: refresh,
    onError: (e) => toast(e.message, 'error'),
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/ads/manage/${id}`),
    onSuccess: () => {
      refresh();
      toast('Ad deleted');
    },
    onError: (e) => toast(e.message, 'error'),
  });

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="muted text-[13px]">Ads show as "Sponsored" in the side panel and "Promoted" between posts in the feed. Blue tick members don't see ads.</p>
        {!adding && <button className="btn-primary shrink-0" onClick={() => setAdding(true)}>New ad</button>}
      </div>
      <FeedFrequency />
      {adding && <NewAdForm onDone={() => setAdding(false)} />}
      {isPending ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState error={error} />
      ) : !data.length ? (
        !adding && <EmptyState icon={Megaphone} title="No ads yet" action={<button className="btn-primary" onClick={() => setAdding(true)}>Create the first ad</button>} />
      ) : (
        <ul>
          {data.map((ad) => {
            const ended = ad.endsAt && new Date(ad.endsAt) < new Date();
            const status = !ad.active ? 'Paused' : ended ? 'Ended' : ad.startsAt && new Date(ad.startsAt) > new Date() ? 'Scheduled' : 'Live';
            const ctr = ad.impressions ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0.0';
            return (
              <li key={ad._id} className="flex flex-wrap items-center gap-4 border-b border-line px-4 py-3">
                {ad.imageUrl ? (
                  <img src={cldUrl(ad.imageUrl, { w: 96, h: 56, gravity: 'auto' })} alt="" className="h-14 w-24 shrink-0 rounded-[6px] object-cover" />
                ) : (
                  <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-[6px] bg-surface-2"><Megaphone className="h-5 w-5 text-ds-fg-3" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{ad.title}</p>
                  <p className="muted truncate text-[13px]">
                    {ad.advertiser} · {PLACEMENTS.find(([v]) => v === ad.placement)?.[1]}
                    {(ad.startsAt || ad.endsAt) && ` · ${day(ad.startsAt) ?? 'now'} to ${day(ad.endsAt) ?? 'no end'}`}
                  </p>
                </div>
                <div className="flex gap-5 text-center text-[13px]">
                  <div><p className="text-[15px] font-semibold">{compact(ad.impressions)}</p><p className="muted">views</p></div>
                  <div><p className="text-[15px] font-semibold">{compact(ad.clicks)}</p><p className="muted">clicks</p></div>
                  <div><p className="text-[15px] font-semibold">{ctr}%</p><p className="muted">click rate</p></div>
                </div>
                <span className={cn('rounded-full px-2.5 py-0.5 text-[13px] font-semibold', status === 'Live' ? 'bg-success-soft text-success' : 'bg-surface-2 text-ds-fg-2')}>
                  {status}
                </span>
                <div className="flex gap-1">
                  <button className="btn-ghost p-2" title={ad.active ? 'Pause' : 'Resume'} aria-label={ad.active ? 'Pause ad' : 'Resume ad'} onClick={() => update.mutate({ id: ad._id, active: !ad.active })}>
                    {ad.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button className="btn-ghost p-2 hover:text-danger" title="Delete" aria-label="Delete ad" onClick={() => window.confirm('Delete this ad for good?') && remove.mutate(ad._id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
