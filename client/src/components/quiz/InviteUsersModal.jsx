import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Search, Send, X } from 'lucide-react';
import { Modal, Spinner } from '../ui';
import Avatar from '../Avatar';
import { api } from '../../api/client';
import { searchPeople, useQuizAction } from '../../hooks/useQuiz';
import { useChatKeys } from '../../hooks/useChatKeys';
import { conversationKey, encryptText } from '../../lib/e2ee';
import { fmtDateTime } from '../../lib/quiz';
import { useAuthStore } from '../../store/auth';

/** The DM text: everything needed to join. */
const inviteText = (quiz, organizer) =>
  [
    `You're invited to a test on Tectum: "${quiz.title}"`,
    `Organised by ${organizer}`,
    `Opens: ${fmtDateTime(quiz.startTime)}`,
    `Closes: ${fmtDateTime(quiz.endTime)}`,
    `Duration: ${quiz.durationMinutes} min`,
    `Access code: ${quiz.accessCode}`,
    `Join: ${window.location.origin}/quiz/join?code=${quiz.accessCode}`,
  ].join('\n');

/**
 * Send the code to members. Everyone chosen gets a notification with the details and code (that
 * always works). If my encrypted Messages are unlocked on this device, my browser also sends each
 * of them a DM - it has to be my browser: chats are end-to-end encrypted, so the server can't.
 */
export default function InviteUsersModal({ quiz, open, onClose }) {
  const me = useAuthStore((s) => s.user);
  const keys = useChatKeys();
  const { invite } = useQuizAction(quiz._id);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState([]);
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return undefined;
    let live = true;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await searchPeople(term);
        if (live) setResults(users);
      } catch {
        /* ignore: keep the old results */
      } finally {
        if (live) setSearching(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const add = (u) => setChosen((c) => (c.some((x) => x._id === u._id) ? c : [...c, u]));
  const remove = (id) => setChosen((c) => c.filter((x) => x._id !== id));

  /** Encrypted DM to one member; false if they haven't set up encrypted messages. */
  const sendDm = async (userId) => {
    const { data: k } = await api.get(`/chat/keys/${userId}`);
    if (!k.key) return false;
    const { data: c } = await api.post('/chat/conversations', { userId });
    const key = await conversationKey(keys.privateKey, keys.keyId, k.key.publicKey, k.key.keyId);
    const { ciphertext, iv } = await encryptText(key, inviteText(quiz, me.name));
    await api.post(`/chat/conversations/${c.conversation._id}/messages`, { ciphertext, iv, senderKeyId: keys.keyId, recipientKeyId: k.key.keyId });
    return true;
  };

  const send = async () => {
    setSending(true);
    try {
      const res = await invite.mutateAsync(chosen.map((u) => u._id));
      let dms = 0;
      let noChat = 0;
      if (keys.status === 'ready') {
        for (const u of res.invited) {
          try {
            if (await sendDm(u._id)) dms += 1;
            else noChat += 1;
          } catch {
            noChat += 1;
          }
        }
      }
      setSummary({ invited: res.invited.length, skipped: res.skipped, dms, noChat, chat: keys.status });
      setChosen([]);
      setQ('');
      setResults([]);
    } catch {
      /* the hook shows the error */
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    setSummary(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Send the code"
      footer={
        summary ? (
          <div className="flex justify-end">
            <button className="btn-primary" onClick={close}>Done</button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="muted text-[13px]">{chosen.length ? `${chosen.length} chosen` : 'Choose members to invite'}</span>
            <button className="btn-primary" disabled={!chosen.length || sending} onClick={send}>
              {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />} Send invitation
            </button>
          </div>
        )
      }
    >
      {summary ? (
        <div className="space-y-2 px-5 py-4 text-[15px]">
          <p>
            <strong>{summary.invited}</strong> {summary.invited === 1 ? 'member was' : 'members were'} invited and got a notification with the code.
          </p>
          {summary.chat === 'ready' ? (
            <p className="text-ds-fg-2">
              Encrypted DM sent to {summary.dms}.{summary.noChat ? ` ${summary.noChat} haven't set up encrypted messages yet, so they have the notification only.` : ''}
            </p>
          ) : (
            <p className="muted text-[13px]">No DMs were sent because your Messages are locked on this device.</p>
          )}
          {summary.skipped > 0 && <p className="muted text-[13px]">{summary.skipped} could not be invited (blocked or no longer on Tectum).</p>}
        </div>
      ) : (
        <div className="space-y-4 px-5 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-fg-3" />
            <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, @handle or exact email" aria-label="Search members" autoFocus />
          </div>
          {chosen.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Chosen members">
              {chosen.map((u) => (
                <li key={u._id} className="chip border-ds-brand/40 py-1 text-ds-brand-text">
                  {u.name}
                  <button onClick={() => remove(u._id)} aria-label={`Remove ${u.name}`} className="-mr-1 rounded-full p-0.5 hover:bg-surface-2">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-[12px] border border-line" aria-label="Search results">
            {searching && (
              <li className="flex justify-center py-4">
                <Spinner />
              </li>
            )}
            {!searching && q.trim().length >= 2 && !results.length && <li className="muted px-4 py-4 text-center text-[14px]">No members found.</li>}
            {q.trim().length < 2 && <li className="muted px-4 py-4 text-center text-[14px]">Type at least 2 letters.</li>}
            {q.trim().length >= 2 &&
              results.map((u) => {
                const picked = chosen.some((x) => x._id === u._id);
                return (
                  <li key={u._id}>
                    <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 disabled:opacity-50" onClick={() => add(u)} disabled={picked}>
                      <Avatar user={u} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] text-ink">{u.name}</span>
                        {u.username && <span className="muted block truncate text-[12px]">@{u.username}</span>}
                      </span>
                      <span className="text-[13px] text-ds-brand-text">{picked ? 'Added' : 'Add'}</span>
                    </button>
                  </li>
                );
              })}
          </ul>
          <p className="muted flex items-start gap-1.5 text-[12px] leading-[18px]">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {keys.status === 'ready' ? (
              'Each member also gets an encrypted DM from you with the code.'
            ) : (
              <span>
                Members get a notification with the code. To also send it as an encrypted DM, <Link to="/messages" className="text-link underline">unlock your Messages</Link> first.
              </span>
            )}
          </p>
        </div>
      )}
    </Modal>
  );
}
