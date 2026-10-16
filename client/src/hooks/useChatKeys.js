import { useEffect } from 'react';
import { create } from 'zustand';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { createKeyBundle, unlockKeyBundle, cachePrivateKey, cachedPrivateKey, forgetPrivateKey, e2eeSupported } from '../lib/e2ee';

/** The unlocked private key lives only in memory (and IndexedDB as a non-extractable key). */
const useKeyStore = create((set) => ({
  privateKey: null,
  keyId: null,
  set: (patch) => set(patch),
}));

/**
 * Where this member stands with encrypted messages:
 *  'unsupported' | 'loading' | 'setup' (no key yet) | 'locked' (needs passphrase) | 'ready'
 * plus actions to set up, unlock, reset and lock.
 */
export function useChatKeys() {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const { privateKey, keyId, set } = useKeyStore();

  const { data: bundle, isPending } = useQuery({
    queryKey: ['chat', 'my-key'],
    queryFn: () => api.get('/chat/keys/me').then((r) => r.data.key),
    enabled: Boolean(me && e2eeSupported),
    staleTime: Infinity,
  });

  // Pick the key up from this device's cache if it was unlocked here before.
  useEffect(() => {
    if (!me || !bundle || (privateKey && keyId === bundle.keyId)) return;
    cachedPrivateKey(me._id, bundle.keyId).then((k) => k && set({ privateKey: k, keyId: bundle.keyId }));
  }, [me, bundle, privateKey, keyId, set]);

  const status = !e2eeSupported
    ? 'unsupported'
    : isPending
      ? 'loading'
      : !bundle
        ? 'setup'
        : privateKey && keyId === bundle.keyId
          ? 'ready'
          : 'locked';

  const saveNew = async (passphrase) => {
    const { bundle: fresh, privateKey: pk } = await createKeyBundle(passphrase);
    const { data } = await api.put('/chat/keys/me', fresh);
    await cachePrivateKey(me._id, fresh.keyId, pk);
    set({ privateKey: pk, keyId: fresh.keyId });
    qc.setQueryData(['chat', 'my-key'], data.key);
  };

  return {
    status,
    bundle,
    keyId: bundle?.keyId,
    privateKey: status === 'ready' ? privateKey : null,
    setup: saveNew,
    /** Replaces the key: older messages become unreadable (the UI warns first). */
    reset: saveNew,
    unlock: async (passphrase) => {
      const pk = await unlockKeyBundle(bundle, passphrase);
      await cachePrivateKey(me._id, bundle.keyId, pk);
      set({ privateKey: pk, keyId: bundle.keyId });
    },
    /** Forget the key on this device (needs the passphrase again next time). */
    lock: async () => {
      await forgetPrivateKey(me._id);
      set({ privateKey: null, keyId: null });
    },
  };
}
