import { User } from '../models/User.js';
import { createNotification } from './notify.js';

/**
 * Mentions are stored in text as "@[Display Name](userId)" and rendered as profile links.
 * Before saving, every mention is checked: people who switched off "Allow others to mention me"
 * (or whose accounts are gone/deactivated) are turned back into plain text, so they get no link
 * and no notification.
 */
export const MENTION_RE = /@\[([^\]\n]{1,80})\]\(([a-f\d]{24})\)/gi;
const MAX_MENTIONS = 10;

export async function resolveMentions(text = '') {
  const ids = [...new Set([...text.matchAll(MENTION_RE)].map((m) => m[2].toLowerCase()))];
  if (!ids.length) return { text, mentionedIds: [] };

  const allowed = new Set(
    (
      await User.find({
        _id: { $in: ids.slice(0, MAX_MENTIONS) },
        deactivatedAt: null,
        'preferences.allowMentions': { $ne: false },
      }).select('_id')
    ).map((u) => String(u._id))
  );

  const clean = text.replace(MENTION_RE, (token, name, id) => (allowed.has(id.toLowerCase()) ? token : name));
  return { text: clean, mentionedIds: [...allowed] };
}

/** Sends "mentioned you" notifications (never to the author themselves). */
export async function notifyMentions(mentionedIds, { sourceUser, post }) {
  await Promise.all(
    mentionedIds
      .filter((id) => String(id) !== String(sourceUser))
      .map((recipient) => createNotification({ recipient, type: 'mention', sourceUser, post }))
  );
}
