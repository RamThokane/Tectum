import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Clock, Users, CalendarClock, FileQuestion } from 'lucide-react';
import { cn } from '../../lib/format';
import { PHASES, ATTEMPT_STATUS, fmtDateTime, plural } from '../../lib/quiz';
import { toast } from '../../store/ui';

const TONES = {
  neutral: 'border-ds-line-strong text-ds-fg-2',
  info: 'border-ds-brand/40 text-ds-brand-text',
  success: 'border-success/40 text-success',
  warning: 'border-warning/40 text-warning',
  danger: 'border-danger/40 text-danger',
  muted: 'border-ds-line text-ds-fg-3',
};

/** Draft / Scheduled / Live / Ended, or an attempt's status, as a small outline pill. */
export function StatusChip({ phase, status, className }) {
  const meta = phase ? PHASES[phase] : ATTEMPT_STATUS[status];
  if (!meta) return null;
  return (
    <span className={cn('chip', TONES[meta.tone], className)}>
      {phase === 'live' && <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />}
      {meta.label}
    </span>
  );
}

/** The access code, big and readable, with a copy button. */
export function CodeBox({ code, className }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast('Could not copy - select the code and copy it', 'error');
    }
  };
  return (
    <div className={cn('flex items-center gap-3 rounded-[12px] border border-line bg-surface-2 px-4 py-3', className)}>
      <div className="min-w-0 flex-1">
        <p className="ds-eyebrow">Access code</p>
        <p className="ds-num select-all font-mono text-[26px] font-semibold tracking-[0.18em] text-ink" aria-label={`Access code ${code.split('').join(' ')}`}>
          {code}
        </p>
      </div>
      <button className="btn-secondary" onClick={copy} aria-label="Copy the access code">
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/** One number with a label (results, stats). */
export function StatTile({ label, value, sub, tone }) {
  return (
    <div className="rounded-[12px] border border-line bg-surface px-4 py-3">
      <p className="ds-eyebrow">{label}</p>
      <p className={cn('ds-num mt-0.5 font-editorial text-[26px] font-medium leading-8', tone === 'success' && 'text-success', tone === 'danger' && 'text-danger')}>{value}</p>
      {sub && <p className="muted text-[12px]">{sub}</p>}
    </div>
  );
}

/** A test in "My Tests": title, status, when, counts. */
export function QuizCard({ quiz, actions }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
      <Link to={quiz.status === 'draft' ? `/quiz/${quiz._id}/edit` : `/quiz/${quiz._id}/manage`} className="min-w-0 flex-1 rounded-[8px] focus-visible:outline-2 focus-visible:outline-link">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-editorial text-[18px] font-medium leading-6 text-ink">{quiz.title}</h3>
          <StatusChip phase={quiz.phase} />
          {quiz.status === 'published' && <span className="chip border-ds-line text-ds-fg-3">{quiz.settings?.listed ? 'On your profile' : 'Private · code'}</span>}
          {quiz.chargeable && <span className="chip border-warning/40 text-warning" title="Published after your free quizzes: a minimal upload charge applies">Upload charge</span>}
        </div>
        <p className="muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          {quiz.startTime && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" /> {fmtDateTime(quiz.startTime)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {quiz.durationMinutes} min
          </span>
          <span className="inline-flex items-center gap-1">
            <FileQuestion className="h-3.5 w-3.5" /> {quiz.totalMarks} marks
          </span>
          {quiz.status === 'published' && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {plural(quiz.participants ?? 0, 'participant')}
              {quiz.averageScore != null && ` · avg ${quiz.averageScore}`}
            </span>
          )}
        </p>
      </Link>
      {actions && <div className="flex shrink-0 flex-wrap gap-1.5">{actions}</div>}
    </div>
  );
}
