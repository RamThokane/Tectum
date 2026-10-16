import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquareText,
  Stethoscope,
  ShieldAlert,
  ListChecks,
  Lightbulb,
  HelpCircle,
  Check,
  Copyright,
  ClipboardList,
  FlaskConical,
  GraduationCap,
  Hospital,
  EyeOff,
  Search,
  Save,
  FileText,
  Trash2,
} from 'lucide-react';
import { listDrafts, saveDraft, deleteDraft } from '../lib/drafts';
import { api } from '../api/client';
import { useUIStore, toast } from '../store/ui';
import { useAuthStore } from '../store/auth';
import { Modal, Toggle } from './ui';
import Avatar from './Avatar';
import MentionTextarea from './MentionTextarea';
import TagInput from './TagInput';
import FileUploadZone from './FileUploadZone';
import ImageRedactor from './ImageRedactor';
import { ReplyPolicyPicker } from './ReplyPolicy';
import { QuotedPost, QuotedComment } from './PostCard';
import PrivacyWarning, { hasPrivacyIssues } from './PrivacyWarning';
import { CASE_FIELDS, IMAGE_ACCEPT, MAX_POST_WORDS, MAX_POST_WORDS_BLUE, MAX_IMAGE_MB, countWords, postWordLimit } from '../lib/constants';
import { specialtyMeta, wardsByGroup } from '../lib/specialties';
import { useMyWards } from '../hooks/useWards';
import { cn, timeAgo } from '../lib/format';
import { CollabPicker } from './Collab';
import { HighlightTextarea } from './Highlight';

/**
 * What you're posting. A Case is the structured case form; the rest are quick posts with a `kind`.
 */
const TYPES = [
  { id: 'pearl', label: 'Pearl', icon: Lightbulb, hint: 'A short, high-yield clinical fact', cls: 'border-link bg-ds-brand-soft text-link' },
  { id: 'case', label: 'Case', icon: Stethoscope, hint: 'A structured, de-identified case', cls: 'border-link bg-ds-brand-soft text-link' },
  { id: 'discussion', label: 'Discussion', icon: MessageSquareText, hint: 'Anything else worth talking about', cls: 'border-link bg-ds-brand-soft text-link' },
];

const PLACEHOLDERS = {
  pearl: 'Share a high-yield pearl… e.g. "Inferior MI + hypotension? Think RV infarct: avoid nitrates."',
  discussion: 'Share a pearl, case, or question… use #tags and @mention colleagues',
};

/** A section of the case form, styled like the same section on the case card. */
function CaseFormSection({ icon: Icon, title, tint, hint, children }) {
  return (
    <section className="rounded-[12px] border border-line p-4">
      <h3 className={cn('ds-eyebrow flex items-center gap-1.5', tint)}>
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} /> {title}
      </h3>
      {hint && <p className="muted mt-0.5 text-[12px]">{hint}</p>}
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

/** Does a Ward match what was typed? Any word of its name (or short name) starting with each typed word. */
function wardMatches(ward, q) {
  if (!q) return true;
  const m = specialtyMeta(ward.slug);
  const hay = `${m.label} ${m.short ?? ''} ${ward.slug.replace(/-/g, ' ')}`.toLowerCase();
  const words = hay.split(/[\s()/&,-]+/).filter(Boolean);
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => words.some((w) => w.startsWith(t)) || hay.includes(t));
}

/**
 * Pick the Ward (specialty channel) a post goes to. A search box over every Ward: your own Wards
 * first, then the rest grouped by course. Type to filter; arrow keys + Enter to choose.
 */
function WardPicker({ value, onChange }) {
  const mine = useMyWards();
  const m = value ? specialtyMeta(value) : null;
  const course = useAuthStore((s) => s.user?.course);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);

  const groups = [
    ...(mine.length ? [{ id: 'mine', label: 'Your Wards', wards: mine }] : []),
    ...wardsByGroup(course).map((g) => ({ ...g, wards: g.wards.filter((w) => !mine.some((x) => x.slug === w.slug)) })),
  ]
    .map((g) => ({ ...g, wards: g.wards.filter((w) => wardMatches(w, q.trim())) }))
    .filter((g) => g.wards.length);
  // One flat list for the keyboard: "No Ward" first (only when not searching), then every match.
  const options = [...(q.trim() ? [] : [{ slug: '' }]), ...groups.flatMap((g) => g.wards)];

  const choose = (slug) => {
    onChange(slug);
    setOpen(false);
    setQ('');
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault(); // never submits the post
      if (open && options[active]) choose(options[active].slug);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation(); // close the list, not the whole dialog
      setOpen(false);
    }
  };
  const optionId = (slug) => `ward-opt-${slug || 'none'}`;
  const row = (slug, label, Icon, soft) => {
    const i = options.findIndex((o) => o.slug === slug);
    return (
      <li
        key={slug || 'none'}
        id={optionId(slug)}
        role="option"
        aria-selected={value === slug}
        onMouseDown={(e) => e.preventDefault()} // keep focus in the search box
        onClick={() => choose(slug)}
        onMouseEnter={() => setActive(i)}
        className={cn('flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[12px] px-2.5 text-[15px]', i === active && 'bg-surface-2')}
      >
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px]', soft ?? 'bg-surface-2 text-ds-fg-3')}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {value === slug && <Check className="h-4 w-4 shrink-0 text-link" aria-hidden="true" />}
      </li>
    );
  };

  return (
    <div>
      <label className="label flex items-center gap-1.5" htmlFor="post-ward">
        <Hospital className="h-4 w-4 text-link" /> Ward <span className="muted font-normal">(which subject is this?)</span>
      </label>
      <div className="flex items-center gap-2">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]', m ? m.soft : 'bg-surface-2 text-ds-fg-3')} aria-hidden="true">
          {m ? <m.icon className="h-5 w-5" /> : <Hospital className="h-5 w-5" />}
        </span>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-fg-3" aria-hidden="true" />
          <input
            id="post-ward"
            role="combobox"
            aria-expanded={open}
            aria-controls="post-ward-list"
            aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? optionId(options[active].slug) : undefined}
            autoComplete="off"
            className="input pl-9"
            // closed: shows the chosen Ward; open: what's being typed
            value={open ? q : m?.label ?? ''}
            placeholder={open ? 'Search Wards, e.g. cardio, ortho, anatomy' : 'No Ward (general) - tap to search'}
            onFocus={() => {
              setOpen(true);
              setActive(0);
            }}
            onClick={() => setOpen(true)}
            onBlur={() => {
              setOpen(false);
              setQ('');
            }}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onKeyDown={onKey}
          />
        </div>
      </div>
      {open && (
        <div className="mt-2 rounded-[12px] border border-line bg-surface p-1.5">
          <ul id="post-ward-list" role="listbox" aria-label="Wards" className="max-h-64 overflow-y-auto overscroll-contain">
            {!q.trim() && row('', 'No Ward (general)', Hospital)}
            {groups.map((g) => (
              <li key={g.id} role="presentation">
                <p className="px-2.5 pb-1 pt-2.5 text-[12px] font-semibold uppercase tracking-wide text-ds-fg-3">{g.label}</p>
                <ul role="group" aria-label={g.label}>
                  {g.wards.map((w) => {
                    const meta = specialtyMeta(w.slug);
                    return row(w.slug, meta.label, meta.icon, meta.soft);
                  })}
                </ul>
              </li>
            ))}
            {!options.length && <li className="muted px-3 py-4 text-center text-[13px]">No Ward matches "{q.trim()}"</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

const emptyCase = () => ({ age: '', sex: '', mcqTips: '', ...Object.fromEntries(CASE_FIELDS.map((f) => [f.key, ''])) });

/** Copyright notice + required confirmation, shown whenever images are attached. */
function CopyrightConfirm({ checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-line p-3.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
        required
      />
      <span className="text-[13px]">
        <span className="font-semibold">I made these images myself or have permission to share them.</span>{' '}
        <span className="text-danger">*</span>
        <span className="muted mt-0.5 block text-[13px] leading-5">
          Don't upload copyrighted material: textbook pages or scans, paid course or coaching material, question banks,
          or images from books, journals or websites without permission.
          Copyrighted uploads will be removed and repeat uploads can lead to a ban.
        </span>
      </span>
    </label>
  );
}

/** Required whenever images are attached: nothing identifies the patient, and there is consent. */
function PatientConsent({ checked, onChange }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-[12px] border-2 p-3.5 transition', checked ? 'border-link bg-ds-brand-soft' : 'border-line-strong')}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ds-brand)]" required />
      <span className="text-[13px]">
        <span className="font-semibold">I confirm this contains no patient-identifying information and I have appropriate consent.</span>{' '}
        <span className="text-danger">*</span>
        <span className="muted mt-0.5 block text-[13px] leading-5">
          No faces, names, dates, hospital or ID numbers. Use “Blur faces or details” above if needed. Hidden photo data such as location is removed automatically.
        </span>
      </span>
    </label>
  );
}

/** Thumbnails of attached images, each with a "Blur faces or details" button. */
function RedactRow({ images, onChange }) {
  const [editing, setEditing] = useState(null);
  // Created and revoked in one effect so a re-run never leaves thumbnails on revoked blobs.
  const [urls, setUrls] = useState([]);
  useEffect(() => {
    const next = images.map((f) => URL.createObjectURL(f));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [images]);
  return (
    <div className="flex flex-wrap gap-2">
      {images.map((f, i) => (
        <button
          key={urls[i]}
          type="button"
          onClick={() => setEditing(i)}
          className="group flex items-center gap-2 rounded-[12px] border border-line bg-surface-2 p-1.5 pr-3 text-[13px] font-semibold transition hover:border-link"
        >
          <img src={urls[i]} alt="" className="h-10 w-10 rounded-[6px] object-cover" />
          <EyeOff className="h-4 w-4 text-link" /> Blur faces or details
        </button>
      ))}
      {editing !== null && (
        <ImageRedactor
          file={images[editing]}
          onClose={() => setEditing(null)}
          onDone={(file) => {
            onChange(images.map((f, j) => (j === editing ? file : f)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/** "MCQ Tips" box: exam-oriented pearls, one per line (shared with the edit dialog). */
export function McqTipsField({ value, onChange }) {
  return (
    <div>
      <label className="label flex items-center gap-1.5" htmlFor="cs-mcq">
        <ListChecks className="h-4 w-4 text-ds-brand-text" /> MCQ Tips <span className="muted font-normal">(optional)</span>
      </label>
      <textarea
        id="cs-mcq"
        className="input"
        rows={3}
        maxLength={2000}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={'One tip per line, e.g.\nMost common artery in inferior MI: right coronary artery\nNitrates are contraindicated in RV infarction'}
      />
      <p className="muted mt-1 text-[12px]">High-yield exam points. Shown to readers after they reveal the diagnosis.</p>
    </div>
  );
}

function initialState() {
  return {
    title: '',
    content: '',
    tags: [],
    images: [],
    sensitive: false,
    caseStudy: emptyCase(),
    deidentified: false,
    replyPolicy: 'everyone',
    ownsRights: false,
    patientConsent: false,
    ward: '',
    collab: 'none', // academic collaboration: none | researchers | students
    // Optional diagnosis poll for cases: up to 4 choices + which one is right.
    pollOptions: ['', '', '', ''],
    correctOption: null,
  };
}

/** The filled-in poll options (blanks dropped) and the correct one's index within them. */
export function compactPoll(options, correct) {
  const filled = [];
  let correctIndex = null;
  options.forEach((o, i) => {
    if (!o.trim()) return;
    if (i === correct) correctIndex = filled.length;
    filled.push(o.trim());
  });
  return { filled, correctIndex };
}

/** What's wrong with a poll, if anything ('' = fine, including no poll at all). */
export const pollProblemOf = ({ filled, correctIndex }) =>
  filled.length === 0 ? '' : filled.length < 2 ? 'Add at least 2 options' : correctIndex == null ? 'Tick the correct answer' : '';

/**
 * "Diagnosis poll" editor: up to 4 choices, tap the letter to mark the right one. Shared by the
 * post form and the edit dialog. With `voteCount` > 0 (editing a poll people already voted on) only
 * the first `fixedCount` choices show and none can be added or removed, so earlier votes still
 * point at the right option.
 */
export function PollEditor({ options, correct, onChange, problem, voteCount = 0, fixedCount = 0 }) {
  const locked = voteCount > 0 && fixedCount > 0;
  return (
    <div>
      <p className="label">Diagnosis poll <span className="muted font-normal">(optional)</span></p>
      <p className="muted mb-2 text-[12px]">
        {locked
          ? `${voteCount} ${voteCount === 1 ? 'person has' : 'people have'} already voted, so you can fix the wording or change the correct answer, but not add or remove choices.`
          : 'Add 2–4 answer choices and tick the correct one. Readers vote, then see the answer.'}
      </p>
      <div className="space-y-2">
        {options.map((o, i) => {
          const letter = String.fromCharCode(65 + i);
          if (locked && i >= fixedCount) return null; // no new choices once people voted
          return (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange({ correctOption: i })}
                disabled={!o.trim()}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-semibold transition disabled:opacity-40',
                  correct === i ? 'border-success/40 bg-success text-white' : 'border-line-strong text-ds-fg-3 hover:border-success/40'
                )}
                title="Mark as the correct answer"
                aria-label={`Mark option ${letter} as correct`}
                aria-pressed={correct === i}
              >
                {correct === i ? <Check className="h-4 w-4" /> : letter}
              </button>
              <input
                className="input py-2"
                maxLength={120}
                value={o}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  onChange({ pollOptions: next, ...(correct === i && !e.target.value.trim() ? { correctOption: null } : {}) });
                }}
                placeholder={i === 0 ? 'e.g. Right ventricular infarction' : i === 1 ? 'e.g. Aortic dissection' : `Option ${letter} (optional)`}
                aria-label={`Option ${letter}`}
              />
            </div>
          );
        })}
      </div>
      {problem && <p className="mt-1.5 text-[12px] font-medium text-danger">{problem}</p>}
    </div>
  );
}

/** Plain case textarea with the same (value, onChange(text)) shape as HighlightTextarea. */
function PlainTextarea({ onChange, ...props }) {
  return <textarea {...props} onChange={(e) => onChange(e.target.value)} />;
}

/** Case parts where the poster can underline key findings in red. */
export const HIGHLIGHT_FIELDS = ['history', 'examinationFindings', 'investigations'];

/** Has anything been typed or attached? (Decides whether closing offers "Save draft".) */
const hasContent = (f) =>
  Boolean(
    f.content.trim() ||
      f.title.trim() ||
      f.tags.length ||
      f.images.length ||
      Object.values(f.caseStudy).some((v) => typeof v === 'string' && v.trim()) ||
      f.pollOptions.some((o) => o.trim())
  );

const TYPE_LABEL = { pearl: 'Pearl', case: 'Case', discussion: 'Discussion' };

/** "Drafts": what this member saved on this device, newest first. */
function DraftsList({ drafts, onOpen, onDelete }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[12px] border border-line">
      {drafts.map((d) => {
        const f = d.form;
        const text = f.title || (d.type === 'case' ? f.caseStudy?.chiefComplaint : '') || f.content || 'Untitled draft';
        return (
          <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
            <button type="button" onClick={() => onOpen(d)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[15px] font-medium">{text}</span>
              <span className="muted block text-[12px]">
                {TYPE_LABEL[d.type] ?? 'Post'} · saved {timeAgo(d.savedAt) === 'now' ? 'just now' : `${timeAgo(d.savedAt)} ago`}
                {d.images?.length ? ` · ${d.images.length} ${d.images.length === 1 ? 'photo' : 'photos'}` : ''}
              </span>
            </button>
            <button type="button" className="btn-secondary min-h-9 px-3 text-[13px]" onClick={() => onOpen(d)}>Open</button>
            <button type="button" className="btn-ghost min-h-9 min-w-9 p-2 text-danger" onClick={() => onDelete(d)} aria-label="Delete draft" title="Delete draft">
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function Composer() {
  const { open, tab: initialTab, quote, quoteKind, kind: initialKind, ward: initialWard } = useUIStore((s) => s.composer);
  const close = useUIStore((s) => s.closeComposer);
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [type, setType] = useState('discussion');
  const [form, setForm] = useState(initialState);
  const [progress, setProgress] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  // A Case is its own post type; everything else is a quick post with a kind.
  const tab = type === 'case' && !quote ? 'case_study' : 'text';
  const kind = type === 'case' ? 'discussion' : type;

  useEffect(() => {
    if (!open) return;
    setType(initialTab === 'case_study' ? 'case' : TYPES.some((t) => t.id === initialKind) ? initialKind : 'discussion');
    if (initialWard) setForm((f) => ({ ...f, ward: initialWard }));
  }, [open, initialTab, initialKind, initialWard]);

  // ---- drafts (saved on this device) ----
  const [drafts, setDrafts] = useState([]);
  const [draftId, setDraftId] = useState(null); // the draft being edited, if any
  const [showDrafts, setShowDrafts] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const refreshDrafts = () => me && listDrafts(me._id).then(setDrafts);
  useEffect(() => {
    if (open && me?._id) listDrafts(me._id).then(setDrafts);
    if (!open) {
      setShowDrafts(false);
      setConfirmClose(false);
    }
  }, [open, me?._id]);

  const reset = () => {
    setForm(initialState());
    setDraftId(null);
    setConfirmClose(false);
  };
  const dirty = !quote && hasContent(form);

  const saveAsDraft = async () => {
    setSavingDraft(true);
    try {
      const { images, ...rest } = form;
      await saveDraft({ id: draftId, userId: me._id, type, form: rest, images });
      toast('Saved to drafts. Open it any time from Drafts when you create a post.');
      reset();
      close();
    } catch {
      toast('Could not save the draft on this device (private browsing blocks it). Copy your text before closing.', 'error');
    } finally {
      setSavingDraft(false);
    }
  };
  const discard = () => {
    reset();
    close();
  };
  /** Cancel / tap outside / Escape: unsaved work gets "Save draft?" first. */
  const requestClose = () => {
    if (create.isPending || savingDraft) return;
    if (confirmClose) return setConfirmClose(false);
    if (dirty) return setConfirmClose(true);
    close();
  };
  const openDraft = (d) => {
    setType(d.type);
    setForm({ ...initialState(), ...d.form, images: d.images ?? [] });
    setDraftId(d.id);
    setShowDrafts(false);
  };
  const removeDraft = async (d) => {
    await deleteDraft(d.id);
    if (d.id === draftId) setDraftId(null);
    const left = await listDrafts(me._id);
    setDrafts(left);
    if (!left.length) setShowDrafts(false);
    toast('Draft deleted');
  };

  const create = useMutation({
    mutationFn: (fd) =>
      api
        .post('/posts', fd, {
          onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
        })
        .then((r) => r.data),
    onSuccess: ({ post, aiReview }) => {
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: ['activity'] }); // study progress: posts shared
      qc.invalidateQueries({ queryKey: ['user', me?._id] });
      if (draftId) deleteDraft(draftId).then(refreshDrafts); // posted: the draft is done
      reset();
      close();
      toast(post.isQuote ? 'Quote posted' : post.type === 'case_study' ? 'Case study published' : 'Posted');
      if (aiReview?.status === 'flagged') {
        toast('AI review: images blurred and sent to moderators (possible patient details). Please check your images.', 'error');
      } else if (['sensitive', 'unverified'].includes(aiReview?.status)) {
        toast('AI review: your images were marked sensitive and are blurred for viewers.');
      }
      navigate(`/post/${post._id}`);
    },
    onError: (e) => toast(e.message, 'error'),
    onSettled: () => setProgress(null),
  });

  const cs = form.caseStudy;
  const words = countWords(form.content);
  const wordLimit = postWordLimit(me);
  const tooLong = tab === 'text' && words > wordLimit;
  // Any post with images needs the copyright confirmation ticked.
  const needsRights = form.images.length > 0;
  const poll = compactPoll(form.pollOptions, form.correctOption);
  const pollProblem = pollProblemOf(poll);
  // Every text box the privacy check covers (only the ones this post type sends).
  const privacyFields = [
    { text: form.content, onChange: (content) => set({ content }) },
    ...(tab === 'case_study'
      ? [
          { text: form.title, onChange: (title) => set({ title }) },
          ...Object.keys(cs)
            .filter((k) => typeof cs[k] === 'string')
            .map((k) => ({ text: cs[k], onChange: (v) => set({ caseStudy: { ...form.caseStudy, [k]: v } }) })),
          ...form.pollOptions.map((o, i) => ({
            text: o,
            onChange: (v) => set({ pollOptions: form.pollOptions.map((x, j) => (j === i ? v : x)) }),
          })),
        ]
      : []),
  ];
  const privacyBlocked = hasPrivacyIssues(privacyFields.map((f) => f.text));
  const canSubmit =
    !privacyBlocked &&
    (!needsRights || form.ownsRights) &&
    (!needsRights || tab === 'case_study' || form.patientConsent) &&
    (tab === 'text'
      ? (form.content.trim() || form.images.length || quote) && !tooLong
      : cs.chiefComplaint.trim().length >= 3 && cs.diagnosis.trim().length >= 2 && form.deidentified && !pollProblem);

  const submit = () => {
    const fd = new FormData();
    fd.append('type', tab);
    if (tab === 'text') fd.append('kind', quote ? 'discussion' : kind);
    fd.append('title', tab === 'case_study' ? form.title.trim() : '');
    fd.append('content', form.content.trim());
    // The Ward is the post's first tag (that's how Wards find their posts).
    fd.append('tags', JSON.stringify(form.ward ? [form.ward, ...form.tags.filter((t) => t !== form.ward)] : form.tags));
    fd.append('replyPolicy', form.replyPolicy);
    if (!quote) fd.append('collab', form.collab);
    if (quote) fd.append(quoteKind === 'comment' ? 'quoteComment' : 'quoteOf', quote._id);
    fd.append('ownsRights', String(needsRights && form.ownsRights));
    fd.append('patientConsent', String(tab === 'case_study' ? form.deidentified : needsRights && form.patientConsent));
    fd.append('isSensitiveContent', String(form.sensitive));
    form.images.forEach((f) => fd.append('images', f));
    if (tab === 'case_study') {
      const withPoll = poll.filled.length
        ? { ...form.caseStudy, pollOptions: poll.filled, correctOption: poll.correctIndex }
        : { ...form.caseStudy };
      fd.append('caseStudy', JSON.stringify(withPoll));
      fd.append('deidentified', String(form.deidentified));
    }
    create.mutate(fd);
  };

  const busy = create.isPending;

  /** One case text field (label + box) from CASE_FIELDS; the label is hidden where the section title says it. */
  const caseField = (key, { hideLabel = false } = {}) => {
    const f = CASE_FIELDS.find((x) => x.key === key);
    const Box = HIGHLIGHT_FIELDS.includes(key) ? HighlightTextarea : PlainTextarea;
    return (
      <div>
        <label className={hideLabel ? 'sr-only' : 'label'} htmlFor={`cs-${key}`}>
          {f.label} {f.required && <span className="text-danger">*</span>}
        </label>
        <Box
          id={`cs-${key}`}
          className="input"
          rows={f.rows}
          placeholder={f.placeholder}
          value={cs[key]}
          onChange={(v) => set({ caseStudy: { ...cs, [key]: v } })}
        />
      </div>
    );
  };

  const imagesField = (
    <div>
      <label className="label">Images <span className="muted font-normal">(optional, up to 4 · max {MAX_IMAGE_MB} MB each)</span></label>
      <FileUploadZone
        files={form.images}
        onChange={(images) => set({ images })}
        accept={IMAGE_ACCEPT}
        multiple
        maxFiles={4}
        maxSizeMB={MAX_IMAGE_MB}
        compact
        label="Add images"
        progress={form.images.length ? progress : null}
      />
      {form.images.length > 0 && (
        <div className="mt-3 space-y-3">
          <Toggle
            checked={form.sensitive}
            onChange={(sensitive) => set({ sensitive })}
            label="Mark images as sensitive"
            description="Blurred until a viewer chooses to see them. Our AI also checks every image and blurs graphic ones automatically."
          />
          <RedactRow images={form.images} onChange={(images) => set({ images })} />
          {/* cases confirm this once, in the case's own box at the end */}
          {tab !== 'case_study' && <PatientConsent checked={form.patientConsent} onChange={(patientConsent) => set({ patientConsent })} />}
          <CopyrightConfirm checked={form.ownsRights} onChange={(ownsRights) => set({ ownsRights })} />
        </div>
      )}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title={showDrafts ? 'Drafts' : quote ? 'Quote post' : 'Create post'}
      size="max-w-2xl"
      footer={
        showDrafts ? (
          <div className="flex justify-end">
            <button className="btn-secondary" onClick={() => setShowDrafts(false)}>Back to post</button>
          </div>
        ) : confirmClose ? (
          // closing with unsaved work: keep it as a draft?
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] font-semibold">Save this post as a draft?</p>
            <div className="ml-auto flex gap-2">
              <button className="btn-ghost text-danger" onClick={discard} disabled={savingDraft}>Discard</button>
              <button className="btn-secondary" onClick={() => setConfirmClose(false)} disabled={savingDraft}>Keep editing</button>
              <button className="btn-primary" onClick={saveAsDraft} disabled={savingDraft}>{savingDraft ? 'Saving…' : 'Save draft'}</button>
            </div>
          </div>
        ) : (
        <>
        <PrivacyWarning fields={privacyFields} className="mb-3" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ReplyPolicyPicker value={form.replyPolicy} onChange={(replyPolicy) => set({ replyPolicy })} disabled={busy} />
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost" onClick={requestClose} disabled={busy}>
              Cancel
            </button>
            {dirty && (
              <button className="btn-secondary" onClick={saveAsDraft} disabled={busy || savingDraft}>
                <Save className="h-4 w-4" strokeWidth={1.5} /> {savingDraft ? 'Saving…' : 'Save draft'}
              </button>
            )}
            <button className="btn-primary min-w-24" onClick={submit} disabled={!canSubmit || busy}>
              {busy ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
        </>
        )
      }
    >
      {showDrafts ? (
        <div className="p-5">
          <p className="muted mb-3 text-[13px]">Drafts are kept on this device only. Open one to finish and post it.</p>
          <DraftsList drafts={drafts} onOpen={openDraft} onDelete={removeDraft} />
        </div>
      ) : (
      <div className="space-y-5 p-5">
        {!quote && (drafts.length > 0 || draftId) && (
          <div className="-mb-2 flex items-center justify-between gap-2 text-[13px]">
            <span className="muted">{draftId ? 'Editing a saved draft' : ''}</span>
            {drafts.length > 0 && (
              <button type="button" className="inline-flex items-center gap-1 font-medium text-link hover:underline" onClick={() => setShowDrafts(true)}>
                <FileText className="h-4 w-4" strokeWidth={1.5} /> Drafts ({drafts.length})
              </button>
            )}
          </div>
        )}
        {/* post type: Pearl / Case / Question / Notes / Image / Discussion */}
        {!quote && (
          <div role="radiogroup" aria-label="What are you posting?" className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => {
              const on = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => !busy && setType(t.id)}
                  title={t.hint}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 rounded-[12px] border-2 px-1 py-2 text-[13px] font-semibold transition',
                    on ? t.cls : 'border-line text-ds-fg-3 hover:bg-surface-2'
                  )}
                >
                  <t.icon className="h-5 w-5" /> {t.label}
                </button>
              );
            })}
          </div>
        )}

        {!quote && <WardPicker value={form.ward} onChange={(ward) => set({ ward })} />}

        {tab === 'text' && (
          <>
            <div className="flex gap-3">
              <Avatar user={me} size="md" />
              <div className="flex-1">
                <MentionTextarea
                  autoFocus
                  value={form.content}
                  onChange={(e) => set({ content: e.target.value })}
                  rows={type === 'notes' || wordLimit === MAX_POST_WORDS_BLUE ? 8 : 5}
                  maxLength={40000}
                  placeholder={quote ? 'Add a comment' : PLACEHOLDERS[type] ?? PLACEHOLDERS.discussion}
                  className="w-full resize-none bg-transparent text-[17px] outline-none placeholder:text-ds-fg-3"
                  aria-label="Post text"
                />
                <p className={cn('text-right text-[12px]', tooLong ? 'font-semibold text-danger' : words > wordLimit * 0.9 ? 'text-warning' : 'muted')}>
                  {words}/{wordLimit} words{tooLong && ' - please shorten your post'}
                  {wordLimit === MAX_POST_WORDS_BLUE && <span className="ml-1 font-semibold text-tick">· Verified</span>}
                </p>
                {wordLimit === MAX_POST_WORDS && words > wordLimit * 0.8 && (
                  <p className="mt-1 text-right text-[12px] text-info">
                    Need more room? Verified members can write up to {MAX_POST_WORDS_BLUE} words.
                  </p>
                )}
                {quote &&
                  (quoteKind === 'comment' ? (
                    <QuotedComment comment={quote} link={false} className="mt-2" />
                  ) : (
                    <QuotedPost quote={quote} link={false} className="mt-2" />
                  ))}
              </div>
            </div>
            {imagesField}
          </>
        )}

        {tab === 'case_study' && (
          <>
            <div className="flex gap-3 rounded-[12px] border border-warning/40 bg-warning-soft p-4 text-warning">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="text-[13px]">
                <p className="font-semibold">De-identify before you post</p>
                <p className="mt-1 text-warning">
                  Remove names, initials, dates of birth, exact dates, MRNs, addresses, phone numbers, facility names and
                  any photo showing faces or identifying marks. Use age ranges (e.g. &ldquo;50s&rdquo;) instead of exact ages.
                </p>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="post-title">
                Case title <span className="muted font-normal">(optional)</span>
              </label>
              <input
                id="post-title"
                className="input text-[15px] font-semibold"
                maxLength={200}
                value={form.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="e.g. 45M Acute Ischemic Stroke with Atypical Progression"
              />
            </div>

            <CaseFormSection icon={Stethoscope} title="Presentation" tint="">
              {caseField('chiefComplaint')}
              <div>
                <label className="label" htmlFor="cs-prompt">Question for readers <span className="muted font-normal">(optional)</span></label>
                <MentionTextarea
                  id="cs-prompt"
                  className="input"
                  rows={2}
                  value={form.content}
                  onChange={(e) => set({ content: e.target.value })}
                  placeholder="What would you do next? Type @ to ask a colleague."
                />
              </div>
            </CaseFormSection>

            <CaseFormSection icon={ClipboardList} title="History" tint="">
              {caseField('history', { hideLabel: true })}
            </CaseFormSection>

            <CaseFormSection icon={Stethoscope} title="Examination" tint="">
              {caseField('examinationFindings', { hideLabel: true })}
            </CaseFormSection>

            <CaseFormSection icon={FlaskConical} title="Labs / Images" tint="">
              {caseField('investigations', { hideLabel: true })}
              {imagesField}
            </CaseFormSection>

            <CaseFormSection
              icon={HelpCircle}
              title="What's your diagnosis?"
              tint=""
              hint="Hidden until a reader votes or taps to reveal it."
            >
              {caseField('diagnosis')}
              {/* optional poll shown on the case card */}
              <PollEditor options={form.pollOptions} correct={form.correctOption} onChange={(p) => set(p)} problem={pollProblem} />
            </CaseFormSection>

            <CaseFormSection icon={GraduationCap} title="Teaching points" tint="" hint="Shown after the answer is revealed.">
              {caseField('learningPoint')}
              <McqTipsField value={cs.mcqTips} onChange={(mcqTips) => set({ caseStudy: { ...cs, mcqTips } })} />
              {caseField('references')}
            </CaseFormSection>

            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-[12px] border-2 p-4 transition',
                form.deidentified ? 'border-link bg-ds-brand-soft' : 'border-line-strong'
              )}
            >
              <input
                type="checkbox"
                checked={form.deidentified}
                onChange={(e) => set({ deidentified: e.target.checked })}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ds-brand)]"
                required
              />
              <span className="text-[13px] font-medium">
                I confirm this contains no patient-identifying information and I have appropriate consent. <span className="text-danger">*</span>
                <span className="muted mt-0.5 block text-[12px] font-normal">
                  No names, exact dates, hospital or ID numbers, or faces. Cases with identifiable information are removed.
                </span>
              </span>
            </label>
          </>
        )}

        <div>
          <label className="label">
            Tags <span className="muted font-normal">(help others find this)</span>
          </label>
          <TagInput value={form.tags} onChange={(tags) => set({ tags })} placeholder="e.g. ecg, mnemonics" />
        </div>

        {!quote && <CollabPicker value={form.collab} onChange={(collab) => set({ collab })} />}

        {/* shown on every post, not just ones with images */}
        <p className="flex gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 text-[12px] leading-5 text-ds-fg-2">
          <Copyright className="mt-0.5 h-4 w-4 shrink-0 text-ds-fg-3" />
          <span>
            <span className="font-semibold">Share only your own work.</span> Don't post copyrighted material: text copied from
            textbooks, paid courses, coaching notes or question banks, or images from books, journals or websites without
            permission. Copyrighted content will be removed, and repeat posts can lead to a ban.
          </span>
        </p>
      </div>
      )}
    </Modal>
  );
}
