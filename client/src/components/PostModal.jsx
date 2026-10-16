import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { api } from '../api/client';
import { Modal, PageLoader, ErrorState } from './ui';
import PostCard from './PostCard';
import CommentThread from './CommentThread';
import { replyNote } from './ReplyPolicy';
import { postHref } from './CompactPost';

/** A post with its comments in a pop-up (opened from the Pearl grid), so you keep your place. */
export default function PostModal({ postId, onClose }) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => api.get(`/posts/${postId}`).then((r) => r.data),
    enabled: Boolean(postId),
  });

  return (
    <Modal open={Boolean(postId)} onClose={onClose} title="Post" size="max-w-2xl">
      {isPending ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div>
          <PostCard post={data.post} full onDeleted={onClose} />
          <div className="flex justify-end border-b border-line px-5 pb-2">
            <Link to={postHref(data.post)} onClick={onClose} className="inline-flex items-center gap-1 text-[13px] font-semibold text-link hover:underline">
              Open full page <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
          <CommentThread postId={postId} comments={data.comments} canReply={data.post.canReply !== false} replyNote={replyNote(data.post)} />
        </div>
      )}
    </Modal>
  );
}
