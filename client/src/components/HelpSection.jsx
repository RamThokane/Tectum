import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Mail, Send, CheckCircle2, Clock, Search } from 'lucide-react';
import { api } from '../api/client';
import { toast } from '../store/ui';
import { MAX_POST_WORDS, MAX_POST_WORDS_BLUE, MAX_IMAGE_MB } from '../lib/constants';
import { timeAgo, cn } from '../lib/format';

export const SUPPORT_EMAIL = 'medtectum@gmail.com';

const CATEGORIES = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'account', label: 'Account or login' },
  { value: 'payment', label: 'Blue tick' },
  { value: 'verification', label: 'Verification / document' },
  { value: 'content', label: 'A post or comment' },
  { value: 'other', label: 'Something else' },
];

const FAQ = [
  {
    topic: 'Posting',
    items: [
      {
        q: 'How do I share a case study?',
        a: 'Click "Post Insight" (or "Share a case" on Home), open the Case Study tab, fill in at least the chief complaint and diagnosis, tick the de-identification box and post. You can add images, an intro and MCQ tips.',
      },
      {
        q: 'What does "de-identified" mean?',
        a: 'Remove anything that could identify a patient: names, initials, dates of birth, exact dates, record numbers, addresses, phone numbers, hospital names and faces. Use age ranges like "50s", and ages over 89 as "90+". Posts with identifiable details are removed.',
      },
      {
        q: 'What are the posting limits?',
        a: `Quick Posts: up to ${MAX_POST_WORDS} words (${MAX_POST_WORDS_BLUE} for blue tick members). Images: up to 4 per post, ${MAX_IMAGE_MB} MB each. Notes files: up to 25 MB, and every notes upload needs a title.`,
      },
      {
        q: 'Why is my image blurred?',
        a: 'Images marked sensitive (by you, or automatically by our safety check) are blurred until a viewer taps "Show image". You can turn the blur off for yourself in Settings > Privacy & Data.',
      },
      {
        q: 'How do I edit or delete my post?',
        a: 'Tap the three dots (...) on your post and choose Edit or Delete.',
      },
    ],
  },
  {
    topic: 'The blue tick',
    items: [
      {
        q: 'How do I get the blue tick?',
        a: 'Upload a licence or ID in Settings > Verification & Blue tick. Our team reviews it, and once it is approved you get the blue tick. It\'s free.',
      },
      {
        q: 'What does the blue tick give me?',
        a: `Priority in the feed, Quick Posts of up to ${MAX_POST_WORDS_BLUE} words, and no ads.`,
      },
    ],
  },
  {
    topic: 'Your account',
    items: [
      {
        q: 'Where are the posts I saved?',
        a: 'Tap the bookmark icon on any post to save it, then find them all under "Saved" in the menu.',
      },
      {
        q: 'How do I change my password or email?',
        a: 'Go to Settings > Account & Security. You\'ll need your current password.',
      },
      {
        q: 'How do I take a break or leave?',
        a: 'Settings > Privacy & Data. Deactivate hides your account until you log in again. Delete removes everything permanently. You can also download your data there first.',
      },
      {
        q: 'How do I report a post?',
        a: 'Tap the three dots (...) on the post and choose "Report post". Our moderators review every report.',
      },
    ],
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-3 text-left text-[15px] font-medium transition-colors hover:text-link"
      >
        {q}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-ds-fg-3 transition', open && 'rotate-180')} strokeWidth={1.5} />
      </button>
      {open && <p className="muted pb-3 text-[15px] leading-[23px]">{a}</p>}
    </li>
  );
}

function Faq() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const groups = FAQ.map((g) => ({
    ...g,
    items: q ? g.items.filter((i) => (i.q + ' ' + i.a).toLowerCase().includes(q)) : g.items,
  })).filter((g) => g.items.length);

  return (
    <section className="card">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-editorial text-[20px] font-medium leading-[26px]">Help & FAQs</h2>
        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-fg-3" strokeWidth={1.5} />
          <input className="input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search help, e.g. blue tick, password, limits…" aria-label="Search help" />
        </label>
      </div>
      <div className="space-y-4 p-5">
        {groups.length === 0 ? (
          <p className="muted text-[15px]">No answers match "{query}". Send us a message below.</p>
        ) : (
          groups.map((g) => (
            <div key={g.topic}>
              <p className="ds-eyebrow">{g.topic}</p>
              <ul className="mt-1">
                {g.items.map((i) => (
                  <FaqItem key={i.q} {...i} />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ContactForm() {
  const qc = useQueryClient();
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const send = useMutation({
    mutationFn: () => api.post('/support', { category, message }).then((r) => r.data),
    onSuccess: (d) => {
      toast(d.message);
      setCategory('');
      setMessage('');
      qc.invalidateQueries({ queryKey: ['support', 'mine'] });
    },
    onError: (e) => toast(e.message, 'error'),
  });

  return (
    <section className="card">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-editorial text-[20px] font-medium leading-[26px]">Contact support</h2>
        <p className="muted mt-0.5 text-[13px] leading-[18px]">Couldn't find an answer? Tell us what's wrong and our team will help.</p>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <label className="label" htmlFor="help-cat">What do you need help with?</label>
          <select id="help-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Choose a topic…</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="help-msg">Describe the problem</label>
          <textarea
            id="help-msg"
            className="input"
            rows={4}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What happened, and what did you expect? Please don't include passwords, card numbers or patient details."
          />
          <p className="muted ds-num mt-1 text-right text-[12px]">{message.length}/2000</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="muted inline-flex items-center gap-1.5 text-[13px] hover:text-link">
            <Mail className="h-4 w-4" /> Or email {SUPPORT_EMAIL}
          </a>
          <button className="btn-primary" disabled={!category || message.trim().length < 10 || send.isPending} onClick={() => send.mutate()}>
            <Send className="h-4 w-4" /> {send.isPending ? 'Sending…' : 'Send message'}
          </button>
        </div>
      </div>
    </section>
  );
}

function MyRequests() {
  const { data } = useQuery({
    queryKey: ['support', 'mine'],
    queryFn: () => api.get('/support/mine').then((r) => r.data.tickets),
  });
  if (!data?.length) return null;
  const label = (v) => CATEGORIES.find((c) => c.value === v)?.label ?? v;
  return (
    <section className="card p-5">
      <h2 className="font-editorial text-[20px] font-medium leading-[26px]">Your requests</h2>
      <ul className="mt-3 space-y-3">
        {data.map((t) => (
          <li key={t._id} className="rounded-[12px] border border-line p-3">
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="font-semibold">{label(t.category)}</span>
              <span className={cn('inline-flex items-center gap-1 font-medium', t.status === 'resolved' ? 'text-success' : 'text-warning')}>
                {t.status === 'resolved' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                {t.status === 'resolved' ? 'Resolved' : 'Open'} · {timeAgo(t.createdAt)}
              </span>
            </div>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[15px]">{t.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function HelpSection() {
  return (
    <div className="space-y-4">
      <Faq />
      <ContactForm />
      <MyRequests />
      <p className="muted px-1 text-[12px]">
        Tectum is for education and peer discussion, not medical advice. Read more on the{' '}
        <Link to="/" className="underline">home page</Link>.
      </p>
    </div>
  );
}
