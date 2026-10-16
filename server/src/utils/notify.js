import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';

let io = null;
export const setIO = (instance) => {
  io = instance;
};

/** Sends a live event to every open tab of one member (no-op if sockets aren't running). */
export const emitToUser = (userId, event, payload) => {
  if (io) io.to(`user:${userId}`).emit(event, payload);
};

const emitTo = async (notification) => {
  if (!io) return;
  const populated = await notification.populate([
    { path: 'sourceUser', select: 'name role verificationStatus profilePicture' },
    { path: 'post', select: 'type content caseStudy.chiefComplaint notesFile.fileName' },
  ]);
  io.to(`user:${notification.recipient}`).emit('notification:new', populated.toJSON());
};

/**
 * Creates a notification (never for actions on your own content).
 * like/repost/follow/notes_saved are de-duplicated so toggling doesn't spam;
 * comments and replies always create a new notification.
 */
export async function createNotification({ recipient, type, sourceUser, post = null }) {
  if (!recipient || String(recipient) === String(sourceUser)) return;
  try {
    // Respect the recipient's notification settings.
    const prefs = await User.findById(recipient).select('preferences.notifications blocked').lean();
    if (prefs?.preferences?.notifications?.[type] === false) return;
    // Nothing from people this member has blocked.
    if (prefs?.blocked?.some((id) => String(id) === String(sourceUser))) return;
    if (type === 'comment' || type === 'reply' || type === 'quote') {
      const doc = await Notification.create({ recipient, type, sourceUser, post });
      return emitTo(doc);
    }
    const res = await Notification.findOneAndUpdate(
      { recipient, type, sourceUser, post },
      { $setOnInsert: { isRead: false } },
      { upsert: true, returnDocument: 'after', includeResultMetadata: true }
    );
    if (!res.lastErrorObject?.updatedExisting) await emitTo(res.value);
  } catch (err) {
    // Notifications are best-effort; never fail the primary action.
    console.error('[notify] failed', err.message);
  }
}

/**
 * "X sent you a message": one notification per sender, moved back to the top and marked unread
 * by each new message (ten messages don't make ten notifications). Never carries the text: chats
 * are end-to-end encrypted, so the server can't read it anyway. Read when the chat is read.
 */
export async function notifyMessage({ recipient, sourceUser, conversation }) {
  if (!recipient || String(recipient) === String(sourceUser)) return;
  try {
    const prefs = await User.findById(recipient).select('preferences.notifications blocked').lean();
    if (prefs?.preferences?.notifications?.message === false) return;
    if (prefs?.blocked?.some((id) => String(id) === String(sourceUser))) return;
    const key = { recipient, type: 'message', sourceUser };
    const before = await Notification.findOneAndUpdate(
      key,
      { $set: { isRead: false, conversation, createdAt: new Date() } },
      { upsert: true, returnDocument: 'before', timestamps: false }
    );
    // Only announce it when the bell count actually goes up (new, or it had been read).
    if (!before || before.isRead) {
      const doc = await Notification.findOne(key);
      if (doc) await emitTo(doc);
    }
  } catch (err) {
    console.error('[notify] message failed', err.message);
  }
}

/**
 * Test notifications ("X invited you to a test", "the time of a test changed", "N people asked to
 * take your test", "you're accepted"). One per member per test and type: a new one moves it back
 * to the top as unread instead of piling up.
 * The note carries the details (title, time, code); `link` opens the join page with the code.
 */
export async function notifyQuiz({ recipient, sourceUser, type, quiz, note, link }) {
  if (!recipient || String(recipient) === String(sourceUser)) return false;
  try {
    const prefs = await User.findById(recipient).select('blocked deactivatedAt').lean();
    if (!prefs || prefs.deactivatedAt) return false;
    if (prefs.blocked?.some((id) => String(id) === String(sourceUser))) return false;
    const doc = await Notification.findOneAndUpdate(
      { recipient, type, quiz },
      { $set: { sourceUser, note: note?.slice(0, 300), link, isRead: false, createdAt: new Date() } },
      { upsert: true, returnDocument: 'after', timestamps: false }
    );
    await emitTo(doc);
    return true;
  } catch (err) {
    console.error('[notify] quiz failed', err.message);
    return false;
  }
}

/** Marks my "X sent you a message" notification read (I opened the chat). */
export async function readMessageNotification(recipient, sourceUser) {
  const { modifiedCount } = await Notification.updateMany({ recipient, type: 'message', sourceUser, isRead: false }, { isRead: true });
  if (modifiedCount) emitToUser(recipient, 'notification:read', { type: 'message' });
}

/** A notice from Tectum itself (e.g. the privacy check); always delivered, shown as coming from Tectum. */
export async function notifyFromTectum({ recipient, type, post = null, note, link }) {
  try {
    const doc = await Notification.create({ recipient, type, sourceUser: recipient, post, note: note?.slice(0, 300), ...(link ? { link } : {}) });
    await emitTo(doc);
  } catch (err) {
    console.error('[notify] failed', err.message);
  }
}

export async function removeNotification({ recipient, type, sourceUser, post = null }) {
  try {
    await Notification.deleteOne({ recipient, type, sourceUser, post });
  } catch (err) {
    console.error('[notify] cleanup failed', err.message);
  }
}
