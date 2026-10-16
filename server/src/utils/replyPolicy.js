import { User } from '../models/User.js';

/**
 * Can `viewer` comment on `post`, given the post's "Who can reply?" setting?
 * `post` needs author (id or populated) + replyPolicy + mentions; `viewer` is the logged-in user doc.
 */
export async function canReplyTo(post, viewer) {
  if (!viewer) return false;
  const authorId = String(post.author?._id ?? post.author);
  const viewerId = String(viewer._id);
  if (authorId === viewerId) return true;

  switch (post.replyPolicy ?? 'everyone') {
    case 'everyone':
      return true;
    case 'verified':
      return viewer.verificationStatus === 'verified';
    case 'mentioned':
      return (post.mentions ?? []).some((id) => String(id) === viewerId);
    case 'following':
    case 'network': {
      const author = await User.findById(authorId).select('following').lean();
      const following = (author?.following ?? []).map(String);
      if (following.includes(viewerId)) return true;
      if (post.replyPolicy === 'following') return false;
      // "Accounts you follow and who they follow": one more hop.
      return Boolean(await User.exists({ _id: { $in: following }, following: viewer._id }));
    }
    default:
      return true;
  }
}
