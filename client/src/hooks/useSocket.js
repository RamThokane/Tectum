import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { API_ORIGIN } from '../api/client';
import { useAuthStore } from '../store/auth';
import { toast, useUIStore } from '../store/ui';

const VERBS = {
  like: 'liked your post',
  comment: 'commented on your post',
  follow: 'started following you',
  repost: 'reposted your post',
  notes_saved: 'saved your notes',
  mention: 'mentioned you',
  reply: 'replied to your comment',
  quote: 'quoted your post',
};

/** Live notifications over socket.io (authenticated by the same httpOnly cookie). */
export function useNotificationSocket() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?._id);

  useEffect(() => {
    if (!userId) return undefined;
    const socket = io(API_ORIGIN || undefined, { withCredentials: true, transports: ['websocket', 'polling'] });

    socket.on('notification:new', (n) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      if (n.type === 'follow') qc.invalidateQueries({ queryKey: ['user', userId] });
      if (n.type?.startsWith('privacy_')) {
        // Tectum's own privacy notices always show, and the flagged post needs refreshing.
        qc.invalidateQueries({ queryKey: ['posts'] });
        toast(n.note ?? 'Privacy warning on your post', 'error');
      } else if (n.type !== 'message' && useUIStore.getState().popups) {
        // (messages already get their own "New message from …" pop-up below)
        toast(`${n.sourceUser?.name ?? 'Someone'} ${VERBS[n.type] ?? 'interacted with you'}`);
      }
    });
    // A chat was read: its "sent you a message" notification is read too, so refresh the bell.
    socket.on('notification:read', () => qc.invalidateQueries({ queryKey: ['notifications'] }));

    // Encrypted direct messages: the payload is ciphertext, so just refresh the chat views.
    socket.on('chat:message', ({ conversationId, from }) => {
      qc.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      qc.invalidateQueries({ queryKey: ['chat', 'unread'] });
      const viewing = window.location.pathname === `/messages/${conversationId}`;
      if (String(from?._id) !== String(userId) && !viewing && useUIStore.getState().popups) {
        toast(`New message from ${from?.name ?? 'someone'}`);
      }
    });
    socket.on('chat:read', () => {
      qc.invalidateQueries({ queryKey: ['chat', 'unread'] });
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, qc]);
}
