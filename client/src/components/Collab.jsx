import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MessageSquareText, Send } from 'lucide-react';
import { CollabIcon, StudyIcon } from './ds/icons';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/ui';
import { postTitle } from './PostCard';
import { specialtyMeta, wardOf } from '../lib/specialties';
import { cn } from '../lib/format';

/**
 * Collaboration status a post can carry. Full class names are written out so Tailwind keeps them.
 * Quiet tints, no glow: co-researchers in the soft blue, student collaboration in the soft coral.
 */
export const COLLAB_OPTIONS = [
  {
    id: 'none',
    label: 'Discussion only',
    hint: 'A normal post',
    icon: MessageSquareText,
    pick: 'border-line-strong bg-surface-2 text-ink',
  },
  {
    id: 'researchers',
    label: 'Looking for co-researchers',
    pill: 'Seeking co-researchers',
    icon: CollabIcon,
    hint: 'Invite doctors and researchers to join your study or project',
    pick: 'border-link bg-ds-brand-soft text-link',
    cls: 'bg-ds-brand-soft text-ds-brand-text',
    button: 'bg-ds-brand text-ds-on-brand hover:bg-ds-brand-hover',
  },
  {
    id: 'students',
    label: 'Open for student collaboration',
    pill: 'Student collaboration open',
    icon: StudyIcon,
    hint: 'Invite students to help with research, audits or case write-ups',
    pick: 'border-ds-accent bg-ds-accent-soft text-ds-accent-text',
    cls: 'bg-ds-accent-soft text-ds-accent-text',
    button: 'bg-ds-brand text-ds-on-brand hover:bg-ds-brand-hover',
  },
];

export const collabOf = (post) => COLLAB_OPTIONS.find((o) => o.id === post?.collab && o.id !== 'none') ?? null;

/** "Seeking co-researchers" / "Student collaboration open" pill (with its icon) for flagged posts. */
export function CollabPill({ post, className }) {
  const c = collabOf(post);
  if (!c) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium leading-4', c.cls, className)}>
      <c.icon size={14} /> {c.pill}
    </span>
  );
}

/** Radio-style picker for the composer and the edit dialog. */
export function CollabPicker({ value, onChange }) {
  return (
    <div>
      <p className="label flex items-center gap-1.5">
        <CollabIcon size={16} className="text-link" /> Collaboration status
      </p>
      <div role="radiogroup" aria-label="Collaboration status" className="grid gap-2 sm:grid-cols-3">
        {COLLAB_OPTIONS.map((o) => {
          const on = (value || 'none') === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.id)}
              title={o.hint}
              className={cn(
                'flex items-center gap-2 rounded-[12px] border px-3 py-2 text-left text-[13px] font-medium leading-tight transition active:scale-[0.98]',
                on ? o.pick : 'border-line text-ds-fg-3 hover:bg-surface-2 hover:text-ink'
              )}
            >
              <o.icon size={16} className="h-4 w-4 shrink-0" strokeWidth={1.5} /> {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The message the author receives when someone taps "Express interest". */
function interestMessage(post, c) {
  const name = post.author?.name ?? 'there';
  const hello = /^dr\.?\s/i.test(name) ? name.split(/\s+/).slice(0, 2).join(' ') : name.split(/\s+/)[0];
  const ward = wardOf(post) ?? post.tags?.[0];
  const topic = postTitle(post) || (ward ? specialtyMeta(ward).label : 'your post');
  const as = c.id === 'researchers' ? 'a co-researcher' : 'a student collaborator';
  const what = post.type === 'case_study' ? 'case' : 'post';
  return `Hi ${hello}, I saw your ${what} "${topic.slice(0, 80)}" on Tectum and I'm interested in collaborating as ${as}. A bit about me: `;
}

/**
 * Big "Express interest" button under a collaboration post: opens a private message to the author
 * with a ready-to-edit note. The author sees how many people can reach them instead.
 */
export function CollabAction({ post, className }) {
  const me = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const c = collabOf(post);
  const start = useMutation({
    mutationFn: () => api.post('/chat/conversations', { userId: post.author._id }).then((r) => r.data.conversation),
    onSuccess: (conv) => navigate(`/messages/${conv._id}`, { state: { draft: interestMessage(post, c) } }),
    onError: (e) => toast(e.message, 'error'),
  });
  if (!c || !post.author?._id) return null;

  if (me?._id === post.author._id) {
    return (
      <p className={cn('flex items-start gap-2 rounded-[12px] bg-surface-2 px-3 py-2 text-[13px]', className)} onClick={(e) => e.stopPropagation()}>
        <c.icon size={16} className="mt-0.5 shrink-0 text-ds-fg-3" />
        <span><span className="font-medium">{c.pill}.</span> <span className="muted">Interested people will message you. Edit the post to close it once you have your team.</span></span>
      </p>
    );
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        start.mutate();
      }}
      disabled={start.isPending}
      className={cn('flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[15px] font-medium transition active:scale-[0.98] disabled:opacity-60', c.button, className)}
    >
      <Send className="h-4 w-4" strokeWidth={1.75} />
      {start.isPending ? 'Opening chat…' : c.id === 'researchers' ? 'Express interest · Collaborate' : 'Express interest · Join as a student'}
    </button>
  );
}
