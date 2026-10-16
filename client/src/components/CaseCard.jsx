import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, Eye, Check, CircleCheck, Lightbulb, GraduationCap, ClipboardList, Stethoscope, FlaskConical, MessageSquareText, BookOpen, ExternalLink, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import { patchPost } from '../hooks/usePosts';
import { toast } from '../store/ui';
import { RichText, ImageGrid, McqTips } from './PostCard';
import { cn, pluralize } from '../lib/format';
import { HighlightedText } from './Highlight';

/** Feed version of a case part: "History: …" on one line, label in bold. */
function InlineSection({ title, children }) {
  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-[23px] text-ds-fg-2">
      <b className="font-semibold text-ink">{title}:</b> {children}
    </p>
  );
}

/** Case-page version: a clean labelled block with an icon (no box around it). */
function BlockSection({ icon: Icon, title, children }) {
  return (
    <section className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-surface-2 text-ds-fg-2" aria-hidden="true">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="ds-eyebrow">{title}</h4>
        <div className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-[23px] text-ink">{children}</div>
      </div>
    </section>
  );
}

/** "Guidelines / papers" list: one per line; http(s) links become links. */
function References({ text }) {
  const lines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  return (
    <div>
      <p className="ds-eyebrow flex items-center gap-1.5">
        <BookOpen className="h-4 w-4" strokeWidth={1.5} /> References
      </p>
      <ul className="mt-1.5 space-y-1 text-[13px] leading-[18px]">
        {lines.map((l, i) => {
          const url = l.match(/https?:\/\/\S+/)?.[0];
          const label = url ? l.replace(url, '').replace(/[\s:–-]+$/, '').trim() || url.replace(/^https?:\/\//, '') : l;
          return (
            <li key={i} className="flex gap-2">
              <span className="muted">•</span>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-w-0 items-center gap-1 break-all text-link hover:underline">
                  {label} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              ) : (
                <span>{l}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * "What's your diagnosis?": large tappable options; after voting, each option shows how many
 * chose it, the correct one is marked (icon + text, not colour alone), then the explanation,
 * MCQ tips and references. Without a poll it's a tap-to-reveal.
 */
function DiagnosisPoll({ post }) {
  const cs = post.caseStudy;
  const qc = useQueryClient();
  const poll = post.poll;
  const options = cs.pollOptions ?? [];
  const voted = poll?.myVote != null;
  const [revealed, setRevealed] = useState(voted);

  // The server sends a case's answer only once the member has voted or revealed it.
  const withAnswers = (answers) => (answers ? { caseStudy: { ...cs, ...answers }, answersHidden: false } : {});

  const vote = useMutation({
    mutationFn: (option) => api.post(`/posts/${post._id}/vote`, { option }).then((r) => r.data),
    onSuccess: ({ poll: p, answers }) => {
      patchPost(qc, post._id, () => ({ poll: p, solved: true, ...withAnswers(answers) }));
      qc.invalidateQueries({ queryKey: ['activity'] });
      setRevealed(true);
    },
    onError: (e) => {
      toast(e.message, 'error');
      // Already voted (e.g. in another tab): reload so the results and their choice show.
      if (e.response?.status === 409) qc.invalidateQueries({ queryKey: ['posts'] });
    },
  });
  // Votes are final: there is no way to take one back or change it.

  // Revealing fetches the answer and counts as having worked through the case (Case Rounds' "solved").
  const revealAnswer = useMutation({
    mutationFn: () => api.post(`/posts/${post._id}/reveal`).then((r) => r.data.answers),
    onSuccess: (answers) => {
      patchPost(qc, post._id, () => ({ solved: true, ...withAnswers(answers) }));
      setRevealed(true);
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
    onError: (e) => toast(e.message, 'error'),
  });
  const reveal = () => (post.answersHidden ? revealAnswer.mutate() : setRevealed(true));

  const pct = (i) => (poll?.total ? Math.round((poll.counts[i] / poll.total) * 100) : 0);
  const gotItRight = voted && poll.myVote === cs.correctOption;

  return (
    <section className="pt-2" onClick={(e) => e.stopPropagation()} aria-label="What's your diagnosis?">
      <h4 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
        <HelpCircle className="h-[18px] w-[18px] text-link" strokeWidth={1.5} /> What's your diagnosis?
      </h4>

      {options.length > 0 && (
        <div className="mt-2 space-y-2" role={voted ? undefined : 'group'}>
          {options.map((o, i) => {
            const correct = cs.correctOption === i;
            const mine = poll?.myVote === i;
            if (!voted) {
              return (
                <button
                  key={i}
                  onClick={() => vote.mutate(i)}
                  disabled={vote.isPending}
                  className="flex min-h-12 w-full items-center gap-3 rounded-[12px] border border-line-strong bg-surface px-3.5 py-2.5 text-left text-[15px] font-medium transition duration-150 hover:border-link hover:bg-ds-brand-soft active:scale-[0.99] disabled:opacity-60"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong font-code text-[12px] font-medium text-ds-fg-3">{String.fromCharCode(65 + i)}</span>
                  {o}
                </button>
              );
            }
            return (
              <div key={i} className={cn('relative min-h-12 overflow-hidden rounded-[12px] border px-3.5 py-2.5 text-[15px]', correct ? 'border-success/50' : mine ? 'border-danger/40' : 'border-line')}>
                <div
                  className={cn('absolute inset-y-0 left-0 transition-[width] duration-500 ease-out', correct ? 'bg-success-soft' : mine ? 'bg-danger-soft' : 'bg-surface-2')}
                  style={{ width: `${pct(i)}%` }}
                  aria-hidden="true"
                />
                <div className="relative flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className={cn('font-medium', correct && 'text-success')}>{o}</span>
                  {correct && (
                    <span className="inline-flex items-center gap-0.5 text-[12px] font-medium text-success">
                      <CircleCheck className="h-4 w-4" strokeWidth={1.75} /> Correct
                    </span>
                  )}
                  {mine && <span className="rounded-[6px] border border-line-strong bg-surface px-1.5 text-[12px] font-medium">Your answer</span>}
                  <span className="ds-num ml-auto font-code text-[13px] font-medium">{pct(i)}%</span>
                </div>
              </div>
            );
          })}
          {voted && (
            <p className={cn('ds-num text-[13px] font-medium', gotItRight ? 'text-success' : 'muted')}>
              {gotItRight ? 'You got it right! ' : ''}
              {pluralize(poll.total, 'vote')} · your vote is final
            </p>
          )}
        </div>
      )}

      {revealed ? (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <p className="flex items-start gap-2 text-[15px] leading-snug">
            <Check className="mt-1 h-5 w-5 shrink-0 text-success" strokeWidth={1.75} aria-hidden="true" />
            <span>
              <span className="ds-eyebrow block">Diagnosis</span>
              <span className="font-editorial text-[20px] font-medium leading-[26px]">{cs.diagnosis}</span>
            </span>
          </p>
          {(cs.learningPoint || cs.mcqTips || cs.references) && (
            <div className="space-y-3">
              <p className="ds-eyebrow flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4" strokeWidth={1.5} /> Explanation
              </p>
              {cs.learningPoint && (
                <div className="flex gap-2.5 rounded-[12px] bg-warning-soft p-3">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.5} aria-hidden="true" />
                  <div>
                    <p className="ds-eyebrow text-warning!">Key learning point</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-[23px] text-ink">{cs.learningPoint}</p>
                  </div>
                </div>
              )}
              <McqTips text={cs.mcqTips} />
              <References text={cs.references} />
            </div>
          )}
        </div>
      ) : (
        <button onClick={reveal} disabled={revealAnswer.isPending} className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-link hover:underline disabled:opacity-60">
          <Eye className="h-4 w-4" strokeWidth={1.5} />{' '}
          {revealAnswer.isPending ? 'Revealing…' : options.length ? 'Skip the poll and reveal the answer' : 'Think first, then tap to reveal the answer'}
        </button>
      )}
    </section>
  );
}

/** Shown on every case. */
export function DeidentifiedNotice({ className }) {
  return (
    <p className={cn('flex items-center gap-1.5 text-[12px] font-medium text-ds-fg-3', className)}>
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" /> De-identified case · For education only, not medical advice
    </p>
  );
}

/**
 * The structured case: chief complaint, then History, Examination and Labs/Images, then the
 * diagnosis poll + reveal. In the feed it's compact and folds with "Read more"; on the case page
 * each part is its own labelled block.
 */
export default function CaseCard({ post, full = false, className }) {
  const cs = post.caseStudy ?? {};
  const labs = cs.investigations;
  const hasImages = post.images?.length > 0;
  const [expanded, setExpanded] = useState(false);

  if (full) {
    return (
      <div className={cn('space-y-4', className)}>
        <h3 className="font-editorial text-[28px] font-medium leading-8 tracking-[-0.015em]">{post.title || cs.chiefComplaint}</h3>
        {post.title && cs.chiefComplaint && <BlockSection icon={Stethoscope} title="Presenting complaint">{cs.chiefComplaint}</BlockSection>}
        {post.content && (
          <BlockSection icon={MessageSquareText} title="Question">
            <RichText text={post.content} as="span" />
          </BlockSection>
        )}
        {cs.history && <BlockSection icon={ClipboardList} title="History"><HighlightedText text={cs.history} /></BlockSection>}
        {cs.examinationFindings && <BlockSection icon={Stethoscope} title="Examination"><HighlightedText text={cs.examinationFindings} /></BlockSection>}
        {(labs || hasImages) && (
          <BlockSection icon={FlaskConical} title="Labs / Images">
            {/* lab values in the mono face, so numbers and units line up and read as data */}
            {labs && <span className="font-code text-[14px] leading-[22px] tracking-tight"><HighlightedText text={labs} /></span>}
            {hasImages && <ImageGrid images={post.images} sensitive={post.isSensitiveContent} className={labs ? 'mt-2' : ''} />}
          </BlockSection>
        )}
        <DiagnosisPoll post={post} />
        <DeidentifiedNotice />
      </div>
    );
  }

  // In feeds a case shows only its opening (title / chief complaint); the rest of the case,
  // images and the diagnosis poll open with "Read more".
  return (
    <div className={cn('space-y-1.5', className)}>
      <h3 className="font-editorial text-[20px] font-medium leading-[26px] tracking-[-0.01em]">{post.title || cs.chiefComplaint}</h3>
      {post.title && cs.chiefComplaint && <InlineSection title="Presenting with">{cs.chiefComplaint}</InlineSection>}
      {expanded ? (
        <>
          <div className="space-y-1">
            {post.content && <RichText text={post.content} className="text-[15px] leading-[23px] text-ink" />}
            {cs.history && <InlineSection title="History"><HighlightedText text={cs.history} /></InlineSection>}
            {cs.examinationFindings && <InlineSection title="Examination"><HighlightedText text={cs.examinationFindings} /></InlineSection>}
            {labs && <InlineSection title="Labs / Images"><HighlightedText text={labs} /></InlineSection>}
          </div>
          {hasImages && <ImageGrid images={post.images} sensitive={post.isSensitiveContent} className="pt-1" />}
          <DiagnosisPoll post={post} />
          <DeidentifiedNotice className="pt-1" />
          <MoreToggle open onClick={() => setExpanded(false)} />
        </>
      ) : (
        <MoreToggle onClick={() => setExpanded(true)} />
      )}
    </div>
  );
}

/** "Read more" / "Show less" under a case in a feed (doesn't open the post). */
function MoreToggle({ open = false, onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-expanded={open}
      className="text-[15px] font-medium text-link hover:underline"
    >
      {open ? 'Show less' : 'Read more'}
    </button>
  );
}
