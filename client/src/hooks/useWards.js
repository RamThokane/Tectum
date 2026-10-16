import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/ui';
import { specialtyMeta } from '../lib/specialties';

/** Every Ward with member/post counts, whether I joined it and how many posts are new to me. */
export function useWards() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: ['wards'],
    queryFn: () => api.get('/wards').then((r) => r.data.wards),
    enabled: status === 'authenticated',
    staleTime: 60_000,
    refetchInterval: 180_000,
  });
}

/** Just the Wards I joined, in the order they're listed. */
export function useMyWards() {
  const { data } = useWards();
  return (data ?? []).filter((w) => w.joined);
}

/**
 * Join / leave a Ward. Optimistic: the button and counts flip at once, and roll back if the
 * server says no. Then the list, the Ward page and my profile are synced with the server's answer.
 */
export function useToggleWard() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const flip = (w) => ({ ...w, joined: !w.joined, members: Math.max(0, (w.members ?? 0) + (w.joined ? -1 : 1)), newCount: 0 });
  return useMutation({
    mutationFn: (slug) => api.post(`/wards/${slug}/join`).then((r) => ({ slug, ...r.data })),
    onMutate: async (slug) => {
      await qc.cancelQueries({ queryKey: ['wards'] });
      const prevList = qc.getQueryData(['wards']);
      const prevWard = qc.getQueryData(['ward', slug]);
      qc.setQueryData(['wards'], (list) => list?.map((w) => (w.slug === slug ? flip(w) : w)));
      qc.setQueryData(['ward', slug], (d) => (d ? { ...d, ward: flip(d.ward) } : d));
      return { prevList, prevWard };
    },
    onSuccess: ({ slug, joined, wards, members }) => {
      qc.setQueryData(['wards'], (list) => list?.map((w) => (w.slug === slug ? { ...w, joined, members, newCount: 0 } : w)));
      qc.setQueryData(['ward', slug], (d) => (d ? { ...d, ward: { ...d.ward, joined, members } } : d));
      if (me) setUser({ ...me, wards });
      qc.invalidateQueries({ queryKey: ['posts', 'wards'] });
      toast(joined ? `Joined ${specialtyMeta(slug).label}` : `Left ${specialtyMeta(slug).label}`);
    },
    onError: (e, slug, ctx) => {
      if (ctx) {
        qc.setQueryData(['wards'], ctx.prevList);
        qc.setQueryData(['ward', slug], ctx.prevWard);
      }
      toast(e.message, 'error');
    },
  });
}

/** Opening a Ward clears its "new posts" dot. */
export function useVisitWard(slug) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!slug) return;
    api
      .post(`/wards/${slug}/visit`)
      .then(() => qc.setQueryData(['wards'], (list) => list?.map((w) => (w.slug === slug ? { ...w, newCount: 0 } : w))))
      .catch(() => {});
  }, [slug, qc]);
}
