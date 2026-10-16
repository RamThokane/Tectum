import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Saves answers as the participant works: changes are queued per question, sent in one batch a
 * moment later (one request at a time), and kept if the connection drops - then retried every
 * few seconds ("Reconnecting…") until they go through. Nothing typed is lost on a crash because
 * each change reaches the server within about a second.
 *
 *   const { queue, flush, status, pending } = useAutosave(save, { onEnded })
 *   status: 'idle' | 'saving' | 'saved' | 'offline'
 */
export function useAutosave(save, { onEnded, delay = 700 } = {}) {
  const pendingRef = useRef(new Map()); // questionId -> latest change
  const inFlight = useRef(false);
  const timer = useRef(null);
  const flushRef = useRef(null); // the latest flush, for timers that call it again later
  const [status, setStatus] = useState('idle');
  const [pending, setPending] = useState(0);
  const saveRef = useRef(save);
  const endedRef = useRef(onEnded);
  useEffect(() => {
    saveRef.current = save;
    endedRef.current = onEnded;
  });

  const later = useCallback((ms) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      flushRef.current?.();
    }, ms);
  }, []);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    timer.current = null;
    if (inFlight.current || !pendingRef.current.size) return;
    const batch = [...pendingRef.current.values()].slice(0, 50);
    batch.forEach((b) => pendingRef.current.delete(b.questionId));
    inFlight.current = true;
    setStatus('saving');
    let retryIn = 0;
    try {
      await saveRef.current(batch);
      setStatus(pendingRef.current.size ? 'saving' : 'saved');
    } catch (e) {
      if (e.response?.status === 409 && e.response?.data?.status) {
        endedRef.current?.(e.response.data.status);
        return;
      }
      // put them back (unless newer changes for the same question arrived meanwhile) and retry
      batch.forEach((b) => !pendingRef.current.has(b.questionId) && pendingRef.current.set(b.questionId, b));
      setStatus(!e.response ? 'offline' : 'saving');
      retryIn = 3000;
    } finally {
      inFlight.current = false;
      setPending(pendingRef.current.size);
      if (pendingRef.current.size) later(retryIn || delay);
    }
  }, [delay, later]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  /** Queue a change for one question (merged with any change not yet sent). */
  const queue = useCallback(
    (change) => {
      const prev = pendingRef.current.get(change.questionId) ?? {};
      pendingRef.current.set(change.questionId, { ...prev, ...change });
      setPending(pendingRef.current.size);
      later(delay);
    },
    [later, delay]
  );

  // back online: send straight away
  useEffect(() => {
    const online = () => flushRef.current?.();
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('online', online);
      clearTimeout(timer.current);
    };
  }, []);

  return { queue, flush, status, pending, hasPending: () => pendingRef.current.size > 0 || inFlight.current };
}
