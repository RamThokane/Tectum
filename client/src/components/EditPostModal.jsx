import { useState } from 'react';
import { Modal, Toggle } from './ui';
import TagInput from './TagInput';
import { useUpdatePost } from '../hooks/usePosts';
import { CASE_FIELDS, MAX_POST_WORDS, countWords, postWordLimit } from '../lib/constants';
import { useAuthStore } from '../store/auth';
import { McqTipsField, PollEditor, compactPoll, pollProblemOf, HIGHLIGHT_FIELDS } from './Composer';
import { HighlightTextarea } from './Highlight';
import MentionTextarea from './MentionTextarea';
import { cn } from '../lib/format';
import { CollabPicker } from './Collab';
import PrivacyWarning, { hasPrivacyIssues } from './PrivacyWarning';

export default function EditPostModal({ post, onClose }) {
  const [title, setTitle] = useState(post.title || '');
  const [content, setContent] = useState(post.content || '');
  const [tags, setTags] = useState(post.tags || []);
  const [sensitive, setSensitive] = useState(!!post.isSensitiveContent);
  const [collab, setCollab] = useState(post.collab || 'none');
  const [caseStudy, setCaseStudy] = useState(() => ({
    age: post.caseStudy?.age || '',
    sex: post.caseStudy?.sex || '',
    mcqTips: post.caseStudy?.mcqTips || '',
    difficulty: post.caseStudy?.difficulty || '',
    ...Object.fromEntries(CASE_FIELDS.map((f) => [f.key, post.caseStudy?.[f.key] || ''])),
  }));
  // "What's your diagnosis?" poll, editable here too (4 boxes, like the post form).
  const savedOptions = post.caseStudy?.pollOptions ?? [];
  const voteCount = post.poll?.total ?? 0;
  const [pollState, setPollState] = useState(() => ({
    pollOptions: [...savedOptions, '', '', '', ''].slice(0, 4),
    correctOption: post.caseStudy?.correctOption ?? null,
  }));
  const poll = compactPoll(pollState.pollOptions, pollState.correctOption);
  // once people voted, every existing choice must stay (votes point at them by position)
  const pollProblem =
    voteCount > 0 && poll.filled.length !== savedOptions.length
      ? `People have already voted, so keep all ${savedOptions.length} choices filled in.`
      : pollProblemOf(poll);
  const update = useUpdatePost({ onDone: onClose });
  const isCase = post.type === 'case_study';
  const wordLimit = postWordLimit(useAuthStore((s) => s.user));
  const tooLong = post.type === 'text' && countWords(content) > wordLimit;
  const titleMissing = post.type === 'notes' && title.trim().length < 3;
  const privacyFields = [
    { text: title, onChange: setTitle },
    { text: content, onChange: setContent },
    ...(isCase
      ? [
        ...Object.keys(caseStudy)
          .filter((k) => typeof caseStudy[k] === 'string')
          .map((k) => ({ text: caseStudy[k], onChange: (v) => setCaseStudy((c) => ({ ...c, [k]: v })) })),
        ...pollState.pollOptions.map((o, i) => ({
          text: o,
          onChange: (v) => setPollState((p) => ({ ...p, pollOptions: p.pollOptions.map((x, j) => (j === i ? v : x)) })),
        })),
      ]
      : []),
  ];
  const privacyBlocked = hasPrivacyIssues(privacyFields.map((f) => f.text));

  const save = () =>
    update.mutate({
      id: post._id,
      title: title.trim(),
      content,
      tags,
      isSensitiveContent: sensitive,
      collab,
      // an emptied poll is sent as [] (= remove it)
      ...(isCase ? { caseStudy: { ...caseStudy, pollOptions: poll.filled, ...(poll.filled.length ? { correctOption: poll.correctIndex } : {}) } } : {}),
    });

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit post"
      footer={
        <>
          <PrivacyWarning fields={privacyFields} className="mb-3" />
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={update.isPending || tooLong || titleMissing || privacyBlocked || (isCase && !!pollProblem)}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-4 p-5">
        {/* Quick posts no longer have headlines; older ones that do can still edit or clear theirs. */}
        <div className={cn(post.type === 'text' && !post.title && 'hidden')}>
          <label className="label" htmlFor="edit-title">
            {post.type === 'notes' ? 'Notes title' : post.type === 'case_study' ? 'Case title' : 'Headline'}{' '}
            {post.type === 'notes' ? <span className="text-danger">*</span> : <span className="muted font-normal">(optional)</span>}
          </label>
          <input id="edit-title" className="input font-semibold" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          {titleMissing && <p className="mt-1.5 text-[12px] font-medium text-danger">Notes need a title (at least 3 characters).</p>}
        </div>
        {isCase ? (
          <>
            {CASE_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label" htmlFor={`edit-cs-${f.key}`}>{f.label}{f.required && ' *'}</label>
                {HIGHLIGHT_FIELDS.includes(f.key) ? (
                  <HighlightTextarea
                    id={`edit-cs-${f.key}`}
                    rows={f.rows}
                    value={caseStudy[f.key]}
                    onChange={(v) => setCaseStudy((c) => ({ ...c, [f.key]: v }))}
                  />
                ) : (
                  <textarea
                    id={`edit-cs-${f.key}`}
                    className="input"
                    rows={f.rows}
                    value={caseStudy[f.key]}
                    onChange={(e) => setCaseStudy((c) => ({ ...c, [f.key]: e.target.value }))}
                  />
                )}
                {/* the diagnosis poll sits right under the diagnosis, as on the post form */}
                {f.key === 'diagnosis' && (
                  <div className="mt-3">
                    <PollEditor
                      options={pollState.pollOptions}
                      correct={pollState.correctOption}
                      onChange={(p) => setPollState((s) => ({ ...s, ...p }))}
                      problem={pollProblem}
                      voteCount={voteCount}
                      fixedCount={savedOptions.length}
                    />
                  </div>
                )}
              </div>
            ))}
            <div>
              <label className="label">Intro / discussion prompt</label>
              <MentionTextarea className="input" rows={2} maxLength={5000} value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
            <McqTipsField value={caseStudy.mcqTips} onChange={(mcqTips) => setCaseStudy((c) => ({ ...c, mcqTips }))} />
          </>
        ) : (
          <div>
            <label className="label">{post.type === 'notes' ? 'Description' : 'Text'}</label>
            <MentionTextarea
              className="input"
              rows={post.type === 'text' && wordLimit > MAX_POST_WORDS ? 10 : 5}
              maxLength={post.type === 'text' ? 40000 : 5000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {post.type === 'text' && (
              <p className={`mt-1 text-right text-[12px] ${tooLong ? 'font-semibold text-danger' : 'muted'}`}>
                {countWords(content)}/{wordLimit} words
              </p>
            )}
          </div>
        )}
        <div>
          <label className="label">Tags</label>
          <TagInput value={tags} onChange={setTags} />
        </div>
        {/* e.g. close the call once the team is complete */}
        <CollabPicker value={collab} onChange={setCollab} />
        {post.images?.length > 0 && (
          <Toggle checked={sensitive} onChange={setSensitive} label="Sensitive clinical images" description="Blur images until viewers choose to see them" />
        )}
      </div>
    </Modal>
  );
}
