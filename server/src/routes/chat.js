import { Router } from 'express';
import { ChatKey, Conversation, Message } from '../models/Chat.js';
import { User } from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { validate, validateObjectId } from '../middleware/validate.js';
import { chatKeySchema, chatMessageSchema, startConversationSchema } from '../validators.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { AUTHOR_FIELDS } from '../utils/serializers.js';
import { emitToUser, notifyMessage, readMessageNotification } from '../utils/notify.js';
import { assertNotBlocked } from '../utils/blocking.js';

/**
 * /api/chat - end-to-end encrypted one-to-one messages.
 * Everything here moves opaque, client-encrypted blobs; nothing can be decrypted server-side.
 */
const router = Router();
router.use(protect);

const PUBLIC_KEY_FIELDS = 'user keyId publicKey';
const pairKeyOf = (a, b) => [String(a), String(b)].sort().join(':');
const otherMember = (conv, me) => conv.members.find((m) => String(m._id ?? m) !== String(me));

async function loadConversation(id, userId) {
  const conv = await Conversation.findById(id);
  if (!conv || !conv.members.some((m) => String(m) === String(userId))) throw ApiError.notFound('Conversation not found');
  return conv;
}

// ---------------- keys ----------------

/** My key bundle (public key + my passphrase-encrypted private key), or null before setup. */
router.get(
  '/keys/me',
  asyncHandler(async (req, res) => {
    const key = await ChatKey.findOne({ user: req.user._id }).lean();
    res.json({ key });
  })
);

/**
 * Create or replace my key bundle. Replacing it (a reset) makes older messages unreadable for
 * everyone, because they were encrypted with the old key - the client warns before doing this.
 */
router.put(
  '/keys/me',
  validate(chatKeySchema),
  asyncHandler(async (req, res) => {
    const key = await ChatKey.findOneAndUpdate(
      { user: req.user._id },
      { ...req.body, user: req.user._id },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();
    res.json({ key });
  })
);

/** Another member's public key (null if they haven't set up messages yet). */
router.get(
  '/keys/:userId',
  validateObjectId('userId'),
  asyncHandler(async (req, res) => {
    const key = await ChatKey.findOne({ user: req.params.userId }).select(PUBLIC_KEY_FIELDS).lean();
    res.json({ key });
  })
);

// ---------------- conversations ----------------

router.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const convs = await Conversation.find({ members: req.user._id, lastMessageAt: { $ne: null } })
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .populate('members', AUTHOR_FIELDS + ' deactivatedAt');
    res.json({
      conversations: convs
        .map((c) => {
          const other = otherMember(c, req.user._id);
          if (!other || other.deactivatedAt) return null;
          return {
            _id: c._id,
            other,
            lastMessageAt: c.lastMessageAt,
            lastSenderIsMe: String(c.lastSender) === String(req.user._id),
            unread: c.unread?.get(String(req.user._id)) ?? 0,
          };
        })
        .filter(Boolean),
    });
  })
);

/** Total unread messages across all my conversations (for the nav badge). */
router.get(
  '/unread',
  asyncHandler(async (req, res) => {
    const convs = await Conversation.find({ members: req.user._id }).select('unread').lean();
    const total = convs.reduce((n, c) => n + (c.unread?.[String(req.user._id)] ?? 0), 0);
    res.json({ unread: total });
  })
);

/** Open (or create) the conversation with a member. */
router.post(
  '/conversations',
  validate(startConversationSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req.body;
    if (String(userId) === String(req.user._id)) throw ApiError.badRequest("You can't message yourself");
    const other = await User.findById(userId).select(AUTHOR_FIELDS + ' deactivatedAt');
    if (!other || other.deactivatedAt) throw ApiError.notFound('Member not found');
    await assertNotBlocked(req.user._id, other._id, "You can't message this account");
    const pairKey = pairKeyOf(req.user._id, userId);
    const conv = await Conversation.findOneAndUpdate(
      { pairKey },
      { $setOnInsert: { pairKey, members: pairKey.split(':') } },
      { upsert: true, returnDocument: 'after' }
    );
    res.json({ conversation: { _id: conv._id, other } });
  })
);

router.get(
  '/conversations/:id',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const conv = await loadConversation(req.params.id, req.user._id);
    await conv.populate('members', AUTHOR_FIELDS);
    res.json({ conversation: { _id: conv._id, other: otherMember(conv, req.user._id) } });
  })
);

/** Messages, newest page first; ?before=<ISO date> loads older ones. */
router.get(
  '/conversations/:id/messages',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const conv = await loadConversation(req.params.id, req.user._id);
    const before = req.query.before ? new Date(req.query.before) : null;
    const messages = await Message.find({ conversation: conv._id, ...(before && !Number.isNaN(+before) ? { createdAt: { $lt: before } } : {}) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ messages: messages.reverse(), hasMore: messages.length === 50 });
  })
);

router.post(
  '/conversations/:id/messages',
  validateObjectId('id'),
  validate(chatMessageSchema),
  asyncHandler(async (req, res) => {
    const conv = await loadConversation(req.params.id, req.user._id);
    const recipient = otherMember(conv, req.user._id);
    await assertNotBlocked(req.user._id, recipient, "You can't message this account");
    const message = await Message.create({ ...req.body, conversation: conv._id, sender: req.user._id });
    await Conversation.updateOne(
      { _id: conv._id },
      { lastMessageAt: message.createdAt, lastSender: req.user._id, $inc: { [`unread.${recipient}`]: 1 } }
    );
    const payload = { conversationId: String(conv._id), message: message.toJSON(), from: { _id: req.user._id, name: req.user.name } };
    emitToUser(recipient, 'chat:message', payload);
    emitToUser(req.user._id, 'chat:message', payload); // the sender's other tabs
    notifyMessage({ recipient, sourceUser: req.user._id, conversation: conv._id }); // the bell (best-effort)
    res.status(201).json({ message });
  })
);

router.post(
  '/conversations/:id/read',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const conv = await loadConversation(req.params.id, req.user._id);
    await Conversation.updateOne({ _id: conv._id }, { $set: { [`unread.${req.user._id}`]: 0 } });
    await readMessageNotification(req.user._id, otherMember(conv, req.user._id));
    emitToUser(req.user._id, 'chat:read', { conversationId: String(conv._id) });
    res.json({ ok: true });
  })
);

export default router;
