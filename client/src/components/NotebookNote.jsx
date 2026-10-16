import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StickyNote, Pencil } from 'lucide-react';
import { api } from '../api/client';
import { patchPost } from '../hooks/usePosts';
import { toast } from '../store/ui';

/**
 * Your private note under a saved post in the Notebook (only you can see it). Written and read
 * like a page: serif text at a generous line height, hung off a thin rule (no sticky-note colour).
 */
export default function NotebookNote({ post }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(post.myNote ?? '');

  const save = useMutation({
    mutationFn: (value) => api.put(`/posts/${post._id}/note`, { text: value }).then((r) => r.data.note),
    onSuccess: (note) => {
      patchPost(qc, post._id, () => ({ myNote: note }));
      setEditing(false);
      toast(note ? 'Note saved' : 'Note removed');
    },
    onError: (e) => toast(e.message, 'error'),
  });

  if (editing) {
    return (
      <div className="border-t border-line bg-surface-2/40 px-4 py-4 sm:px-5" onClick={(e) => e.stopPropagation()}>
        <label className="ds-eyebrow mb-2 flex items-center gap-1.5" htmlFor={`note-${post._id}`}>
          <StickyNote className="h-3.5 w-3.5" strokeWidth={1.75} /> My note <span className="font-normal normal-case tracking-normal">· only you can see this</span>
        </label>
        <textarea
          id={`note-${post._id}`}
          autoFocus
          className="input bg-surface font-editorial text-[17px]! leading-[26px]"
          rows={4}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Remember: nitrates are contraindicated in RV infarct. Revise with Harrison ch. 274."
        />
        <div className="mt-2 flex justify-end gap-2">
          <button className="btn-ghost px-3 py-1.5 text-[13px]" onClick={() => { setText(post.myNote ?? ''); setEditing(false); }} disabled={save.isPending}>
            Cancel
          </button>
          <button className="btn-primary px-3.5 py-1.5 text-[13px]" onClick={() => save.mutate(text.trim())} disabled={save.isPending || text.trim() === (post.myNote ?? '')}>
            {save.isPending ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </div>
    );
  }

  if (post.myNote) {
    return (
      <button
        onClick={() => { setText(post.myNote); setEditing(true); }}
        className="group block w-full border-t border-line px-4 py-4 text-left transition-colors hover:bg-surface-2/50 sm:px-5"
        title="Edit your note"
      >
        <span className="ds-eyebrow flex items-center gap-1.5">
          <StickyNote className="h-3.5 w-3.5" strokeWidth={1.75} /> My note
          <Pencil className="ml-auto h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" strokeWidth={1.5} />
        </span>
        <span className="mt-1.5 block whitespace-pre-wrap break-words border-l-2 border-line-strong pl-3 font-editorial text-[17px] leading-[26px] text-ink">
          {post.myNote}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex w-full items-center gap-2 border-t border-dashed border-line px-4 py-2.5 text-[13px] font-medium text-ds-fg-3 transition hover:bg-surface-2 hover:text-ink sm:px-5"
    >
      <StickyNote className="h-4 w-4" strokeWidth={1.5} /> Add a private note
    </button>
  );
}
