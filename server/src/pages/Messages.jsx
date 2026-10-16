import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Lock, MailPlus, Search, SendHorizontal, ShieldCheck, KeyRound, Info } from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/ui';
import { useChatKeys } from '../hooks/useChatKeys';
import { conversationKey, encryptText, decryptText, safetyNumber } from '../lib/e2ee';
import { PageShell } from '../components/Layout';
import Avatar from '../components/Avatar';
import { Tick } from '../components/VerificationBadge';
import { Modal, PageLoader, EmptyState } from '../components/ui';
import { userTitle } from '../lib/constants';
import { cn, timeAgo, fullDate } from '../lib/format';

// ---------------------------------------------------------------- setup / unlock

function PassphraseField({ id, label, value, onChange, autoFocus }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} type="password" className="input" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" autoFocus={autoFocus} />
    </div>
  );
}

/** First visit: choose a chat passphrase, which protects this member's private key. */
function SetupPanel({ onSetup, resetting = false, onCancel }) {
  const [pass, setPass] = useState('');
  const [again, setAgain] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const error = pass && pass.length < 8 ? 'Use at least 8 characters' : again && again !== pass ? "Passphrases don't match" : '';
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSetup(pass);
      toast(resetting ? 'New chat key created' : 'Encrypted messages are ready');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 px-4 py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-link">
        <Lock className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <h2 className="font-editorial text-[28px] font-medium leading-8 tracking-[-0.015em]">{resetting ? 'Reset your chat key' : 'Set up private messages'}</h2>
      {resetting ? (
        <p className="text-[15px] leading-[23px] text-danger">
          Resetting creates a new key. <strong>Messages sent before now can no longer be read</strong>, by you or by the people you
          chatted with. Only do this if you've forgotten your passphrase.
        </p>
      ) : (
        <p className="muted text-[15px] leading-[23px]">
          Messages on Tectum are end-to-end encrypted: they're locked on your device and can only be unlocked by the person you're
          talking to. Not even Tectum can read them. Choose a <strong>chat passphrase</strong>. You'll need it to read your messages
          on a new phone or computer.
        </p>
      )}
      <PassphraseField id="pp1" label="Chat passphrase (at least 8 characters)" value={pass} onChange={setPass} autoFocus />
      <PassphraseField id="pp2" label="Type it again" value={again} onChange={setAgain} />
      {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
      <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-[18px]">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ds-brand)]" />
        <span>I understand that if I forget this passphrase, Tectum cannot recover my messages.</span>
      </label>
      <div className="flex gap-2">
        <button className="btn-primary flex-1 py-2.5" disabled={busy || !ok || pass.length < 8 || pass !== again}>
          {busy ? 'Creating your key…' : resetting ? 'Reset key' : 'Turn on encrypted messages'}
        </button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

/** Returning on a new device (or after locking): enter the passphrase to unlock the key. */
function UnlockPanel({ onUnlock, onReset }) {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  if (resetting) return <SetupPanel resetting onSetup={onReset} onCancel={() => setResetting(false)} />;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onUnlock(pass);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 px-4 py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-link">
        <KeyRound className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <h2 className="font-editorial text-[28px] font-medium leading-8 tracking-[-0.015em]">Unlock your messages</h2>
      <p className="muted text-[15px] leading-[23px]">Enter your chat passphrase to read your encrypted messages on this device.</p>
      <PassphraseField id="unlock" label="Chat passphrase" value={pass} onChange={setPass} autoFocus />
      <button className="btn-primary w-full py-2.5" disabled={busy || !pass}>{busy ? 'Unlocking…' : 'Unlock'}</button>
      <button type="button" className="text-[13px] font-medium text-link hover:underline" onClick={() => setResetting(true)}>
        Forgot your passphrase?
      </button>
    </form>
  );
}

// ---------------------------------------------------------------- list + new message

function NewMessageModal({ onClose }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { data } = useQuery({
    queryKey: ['mentionable', q],
    queryFn: () => api.get('/users/mentionable', { params: { q } }).then((r) => r.data.users),
    enabled: q.trim().length > 0,
  });
  const start = useMutation({
    mutationFn: (userId) => api.post('/chat/conversations', { userId }).then((r) => r.data.conversation),
    onSuccess: (c) => {
      onClose();
      navigate(`/messages/${c._id}`);
    },
    onError: (e) => toast(e.message, 'error'),
  });
  return (
    <Modal open onClose={onClose} title="New message" size="max-w-md">
      <div className="border-b border-line px-4 py-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-fg-3" strokeWidth={1.5} />
          <input autoFocus className="w-full bg-transparent py-2 pl-9 text-[15px] outline-none" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {(data ?? []).map((u) => (
          <button key={u._id} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2" onClick={() => start.mutate(u._id)}>
            <Avatar user={u} size="md" />
            <span className="min-w-0">
              <span className="flex items-center gap-1 font-semibold">{u.name} <Tick user={u} /></span>
              <span className="muted block truncate text-[13px]">{userTitle(u)}{u.institution && ` · ${u.institution}`}</span>
            </span>
          </button>
        ))}
        {q && data?.length === 0 && <p className="muted px-4 py-6 text-center text-[15px]">No one found</p>}
      </div>
    </Modal>
  );
}

function ConversationList({ activeId, onNew }) {
  const { data, isPending } = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: () => api.get('/chat/conversations').then((r) => r.data.conversations),
  });
  if (isPending) return <PageLoader />;
  if (!data.length) {
    return (
      <EmptyState icon={MailPlus} title="Welcome to your inbox" action={<button className="btn-primary" onClick={onNew}>Write a message</button>}>
        Private, end-to-end encrypted conversations with other members.
      </EmptyState>
    );
  }
  return (
    <ul>
      {data.map((c) => (
        <li key={c._id}>
          <Link
            to={`/messages/${c._id}`}
            className={cn(
              'flex items-center gap-3 px-4 py-3 transition-colors',
              c._id === activeId ? 'bg-ds-brand-soft' : 'hover:bg-surface-2'
            )}
          >
            <Avatar user={c.other} size="md" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-[15px]">
                <span className="truncate font-semibold">{c.other.name}</span>
                <Tick user={c.other} />
                <span className="muted ml-auto shrink-0 text-[12px]">{timeAgo(c.lastMessageAt)}</span>
              </span>
              <span className={cn('flex items-center gap-1 truncate text-[13px]', c.unread ? 'font-medium text-ink' : 'muted')}>
                <Lock className="h-3 w-3 shrink-0" strokeWidth={1.75} /> {c.lastSenderIsMe ? 'You sent a message' : c.unread ? `${c.unread} new message${c.unread > 1 ? 's' : ''}` : 'Encrypted message'}
              </span>
            </span>
            {c.unread > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ds-accent" aria-label="Unread" />}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- thread

function SafetyNumberModal({ myKeyId, theirKeyId, name, onClose }) {
  const [groups, setGroups] = useState(null);
  useEffect(() => {
    safetyNumber(myKeyId, theirKeyId).then(setGroups);
  }, [myKeyId, theirKeyId]);
  return (
    <Modal open onClose={onClose} title="Encryption" size="max-w-md">
      <div className="space-y-3 p-5 text-[15px] leading-6">
        <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 shrink-0 text-success" strokeWidth={1.5} /> Messages with {name} are end-to-end encrypted.</p>
        <p className="muted">
          To be sure no one is in the middle, compare this safety number with {name}, in person or on a call. If both of you see
          the same numbers, your chat is secure.
        </p>
        <div className="ds-num grid grid-cols-4 gap-2 rounded-[12px] border border-line p-4 text-center font-code text-[15px]">
          {(groups ?? []).map((g, i) => <span key={i}>{g}</span>)}
        </div>
      </div>
    </Modal>
  );
}

function Thread({ conversationId, keys }) {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  // "Express interest" on a collaboration post opens the chat with a ready-to-edit note.
  const location = useLocation();
  const navigate = useNavigate();
  const [text, setText] = useState(() => location.state?.draft ?? '');
  useEffect(() => {
    // Use the note once; don't bring it back if this chat is reopened later.
    if (location.state?.draft) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on open, by design
  }, []);
  const [showSafety, setShowSafety] = useState(false);
  const bottom = useRef(null);

  const { data: conv } = useQuery({
    queryKey: ['chat', 'conversation', conversationId],
    queryFn: () => api.get(`/chat/conversations/${conversationId}`).then((r) => r.data.conversation),
  });
  const other = conv?.other;
  const { data: theirKey, isPending: keyPending } = useQuery({
    queryKey: ['chat', 'key', other?._id],
    queryFn: () => api.get(`/chat/keys/${other._id}`).then((r) => r.data.key),
    enabled: Boolean(other),
  });
  const { data: raw } = useQuery({
    queryKey: ['chat', 'messages', conversationId],
    queryFn: () => api.get(`/chat/conversations/${conversationId}/messages`).then((r) => r.data.messages),
  });

  // Decrypt every message in the browser. A message sent with an older key (before someone reset) can't be opened.
  const [plain, setPlain] = useState({});
  useEffect(() => {
    if (!raw || !keys.privateKey) return;
    let cancelled = false;
    (async () => {
      const out = {};
      for (const m of raw) {
        const mine = String(m.sender) === String(me._id);
        const myKeyForMsg = mine ? m.senderKeyId : m.recipientKeyId;
        const theirKeyForMsg = mine ? m.recipientKeyId : m.senderKeyId;
        if (myKeyForMsg !== keys.keyId || !theirKey || theirKeyForMsg !== theirKey.keyId) {
          out[m._id] = { error: 'This message was sent with an older key and can’t be decrypted.' };
          continue;
        }
        try {
          const k = await conversationKey(keys.privateKey, keys.keyId, theirKey.publicKey, theirKey.keyId);
          out[m._id] = { text: await decryptText(k, m.ciphertext, m.iv) };
        } catch {
          out[m._id] = { error: 'This message couldn’t be decrypted.' };
        }
      }
      if (!cancelled) setPlain(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [raw, keys.privateKey, keys.keyId, theirKey, me._id]);

  // Opening the chat (or a new message arriving while it's open) marks it read.
  useEffect(() => {
    if (!raw) return;
    api.post(`/chat/conversations/${conversationId}/read`).then(() => {
      qc.invalidateQueries({ queryKey: ['chat', 'unread'] });
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    }).catch(() => {});
  }, [raw, conversationId, qc]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [plain]);

  const send = useMutation({
    mutationFn: async (body) => {
      const k = await conversationKey(keys.privateKey, keys.keyId, theirKey.publicKey, theirKey.keyId);
      const { ciphertext, iv } = await encryptText(k, body);
      return api
        .post(`/chat/conversations/${conversationId}/messages`, { ciphertext, iv, senderKeyId: keys.keyId, recipientKeyId: theirKey.keyId })
        .then((r) => r.data.message);
    },
    onSuccess: (m) => {
      qc.setQueryData(['chat', 'messages', conversationId], (d) => (d && !d.some((x) => x._id === m._id) ? [...d, m] : d));
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      setText('');
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const submit = (e) => {
    e.preventDefault();
    if (text.trim() && !send.isPending) send.mutate(text.trim());
  };

  if (!other) return <PageLoader />;
  const canSend = theirKey && !keyPending;

  return (
    <div className="flex h-[calc(100dvh-8.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col md:h-[calc(100dvh-1.5rem)]">
      <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <Link to="/messages" className="-ml-2 rounded-full p-2 text-ds-fg-2 hover:bg-surface-2 md:hidden" aria-label="Back to messages">
          <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
        </Link>
        <Link to={`/profile/${other._id}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar user={other} size="sm" />
          <span className="min-w-0">
            <span className="flex items-center gap-1 font-editorial text-[17px] font-medium leading-[23px]">{other.name} <Tick user={other} /></span>
            <span className="muted flex items-center gap-1 text-[12px]"><Lock className="h-3 w-3" strokeWidth={1.75} /> End-to-end encrypted</span>
          </span>
        </Link>
        {theirKey && (
          <button className="rounded-full p-2 text-ds-fg-3 hover:bg-surface-2 hover:text-ink" onClick={() => setShowSafety(true)} title="Encryption details" aria-label="Encryption details">
            <Info className="h-5 w-5" strokeWidth={1.5} />
          </button>
        )}
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        <p className="muted mx-auto mb-4 flex max-w-sm items-center justify-center gap-1.5 text-center text-[12px] leading-4">
          <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} /> Messages are end-to-end encrypted. No one outside this chat, not even Tectum, can read them.
        </p>
        {(raw ?? []).map((m) => {
          const mine = String(m.sender) === String(me._id);
          const p = plain[m._id];
          return (
            <div key={m._id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className="max-w-[75%]">
                <div
                  className={cn(
                    'whitespace-pre-wrap break-words rounded-[20px] px-4 py-2.5 text-[15px] leading-[21px]',
                    p?.error ? 'muted border border-dashed border-line italic' : mine ? 'rounded-br-[6px] bg-ds-brand text-ds-on-brand' : 'rounded-bl-[6px] bg-ds-bubble-in text-ink'
                  )}
                >
                  {p ? p.text ?? p.error : '…'}
                </div>
                <p className={cn('muted mt-1 px-1 text-[12px]', mine && 'text-right')} title={fullDate(m.createdAt)}>{timeAgo(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {keyPending ? null : canSend ? (
        // the composer floats over the end of the thread: glass, as on every floating bar
        <form onSubmit={submit} className="ds-glass m-2 flex items-end gap-2 rounded-[20px] p-1.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submit(e)}
            rows={1}
            maxLength={5000}
            placeholder="Start a new message"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-[14px] bg-transparent px-3 py-2.5 text-[15px] leading-5 outline-none placeholder:text-ds-fg-3"
            aria-label="Message"
          />
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ds-brand text-ds-on-brand transition hover:bg-ds-brand-hover active:scale-95 disabled:bg-surface-2 disabled:text-ds-fg-3" disabled={!text.trim() || send.isPending} aria-label="Send">
            <SendHorizontal className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </form>
      ) : (
        <p className="muted border-t border-line px-4 py-4 text-center text-[15px]">
          {other.name} hasn't turned on encrypted messages yet. You'll be able to message them once they open Messages on Tectum.
        </p>
      )}
      {showSafety && <SafetyNumberModal myKeyId={keys.keyId} theirKeyId={theirKey.keyId} name={other.name} onClose={() => setShowSafety(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------- page

export default function Messages() {
  const { id } = useParams();
  const keys = useChatKeys();
  const [newOpen, setNewOpen] = useState(false);
  const header = useMemo(
    () => (
      <div className="flex items-center gap-1">
        {keys.status === 'ready' && (
          <button className="rounded-full p-2 text-ds-fg-2 hover:bg-surface-2 hover:text-ink" onClick={() => setNewOpen(true)} title="New message" aria-label="New message">
            <MailPlus className="h-5 w-5" strokeWidth={1.5} />
          </button>
        )}
      </div>
    ),
    [keys.status]
  );

  let body;
  if (keys.status === 'unsupported') {
    body = <EmptyState icon={Lock} title="Your browser can't do encrypted messages">Please use an up-to-date Chrome, Edge, Safari or Firefox.</EmptyState>;
  } else if (keys.status === 'loading') {
    body = <PageLoader />;
  } else if (keys.status === 'setup') {
    body = <SetupPanel onSetup={keys.setup} />;
  } else if (keys.status === 'locked') {
    body = <UnlockPanel onUnlock={keys.unlock} onReset={keys.reset} />;
  } else {
    body = (
      <div className="flex">
        <div className={cn('w-full border-line md:w-[340px] md:shrink-0 md:border-r', id && 'hidden md:block')}>
          <ConversationList activeId={id} onNew={() => setNewOpen(true)} />
        </div>
        <div className={cn('min-w-0 flex-1', !id && 'hidden md:block')}>
          {id ? (
            <Thread key={id} conversationId={id} keys={keys} />
          ) : (
            <EmptyState icon={Lock} title="Select a message" action={<button className="btn-primary" onClick={() => setNewOpen(true)}>New message</button>}>
              Choose from your existing conversations, or start a new one.
            </EmptyState>
          )}
        </div>
      </div>
    );
  }

  return (
    <PageShell bare wide title={id ? undefined : 'Messages'} actions={id ? undefined : header}>
      {body}
      {newOpen && <NewMessageModal onClose={() => setNewOpen(false)} />}
    </PageShell>
  );
}
