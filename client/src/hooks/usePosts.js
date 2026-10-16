import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { toast } from '../store/ui';

/** Counts a notes open/download for the library ranking (once per member; failures are ignored). */
export const recordDownload = (postId) =>
  postId
    ? api.post(`/posts/${postId}/download`).then((r) => r.data.downloadCount).catch(() => undefined)
    : Promise.resolve(undefined);

/**
 * Posts appear in many caches (feeds, profile tabs, notes library, search, detail).
 * These helpers apply one change to every cached copy so the UI stays consistent.
 */
const mapPostsIn = (data, fn) => {
  if (!data) return data;
  if (Array.isArray(data.pages)) {
    return { ...data, pages: data.pages.map((p) => ({ ...p, posts: fn(p.posts ?? []) })) };
  }
  let next = data;
  if (Array.isArray(data.posts)) next = { ...next, posts: fn(data.posts) };
  if (data.post) {
    const [mapped] = fn([data.post]);
    next = { ...next, post: mapped ?? null };
  }
  return next;
};

const POST_CACHES = { predicate: (q) => ['posts', 'post', 'search'].includes(q.queryKey[0]) };

export function patchPost(qc, id, updater) {
  qc.setQueriesData(POST_CACHES, (data) =>
    mapPostsIn(data, (posts) => posts.map((p) => (p._id === id ? { ...p, ...updater(p) } : p)))
  );
}

export function removePost(qc, id) {
  qc.setQueriesData(POST_CACHES, (data) => mapPostsIn(data, (posts) => posts.filter((p) => p._id !== id)));
}

const TOGGLES = {
  like: { flag: 'liked', count: 'likeCount' },
  repost: { flag: 'reposted', count: 'repostCount' },
  bookmark: { flag: 'bookmarked', count: 'bookmarkCount' },
};

/** Optimistic like / repost / bookmark toggle. */
export function useTogglePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }) => api.post(`/posts/${id}/${action}`).then((r) => r.data),
    onMutate: ({ id, action }) => {
      const { flag, count } = TOGGLES[action];
      patchPost(qc, id, (p) => ({ [flag]: !p[flag], [count]: Math.max(0, (p[count] ?? 0) + (p[flag] ? -1 : 1)) }));
    },
    onSuccess: ({ post }, { action }) => {
      patchPost(qc, post._id, () => post);
      if (action === 'repost') qc.invalidateQueries({ queryKey: ['posts', 'user'] }); // profile "Reposts" tabs
      if (action === 'bookmark') {
        toast(post.bookmarked ? 'Saved to your Notebook.' : 'Removed from your Notebook');
        qc.invalidateQueries({ queryKey: ['posts', 'saved'] });
      }
    },
    onError: (err, { id, action }) => {
      const { flag, count } = TOGGLES[action];
      patchPost(qc, id, (p) => ({ [flag]: !p[flag], [count]: Math.max(0, (p[count] ?? 0) + (p[flag] ? -1 : 1)) }));
      toast(err.message, 'error');
    },
  });
}

export function useDeletePost({ onDeleted } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/posts/${id}`).then((r) => r.data),
    onSuccess: (_d, id) => {
      removePost(qc, id);
      qc.invalidateQueries({ queryKey: ['user'] });
      toast('Post deleted');
      onDeleted?.();
    },
    onError: (err) => toast(err.message, 'error'),
  });
}

export function useUpdatePost({ onDone } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/posts/${id}`, body).then((r) => r.data),
    onSuccess: ({ post }) => {
      patchPost(qc, post._id, () => post);
      toast('Post updated');
      onDone?.();
    },
    onError: (err) => toast(err.message, 'error'),
  });
}

export function useReportPost() {
  return useMutation({
    mutationFn: ({ id, reason }) => api.post(`/posts/${id}/report`, { reason }).then((r) => r.data),
    onSuccess: (d) => toast(d.message),
    onError: (err) => toast(err.message, 'error'),
  });
}
