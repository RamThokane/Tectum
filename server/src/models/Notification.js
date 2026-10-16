import mongoose from 'mongoose';

// privacy_warning / privacy_removed / verification come from Tectum itself (sourceUser = the recipient).
// message: someone sent me a chat message (one per sender, back to unread on each new message).
// verification: the result of my blue-tick request.
// content_hidden / content_removed: my post or reply was hidden after member reports / removed by a moderator.
// quiz_invite / quiz_update: invited to a test (with its code) / an invited test's times changed.
// quiz_request: (to the host) members asked to take my test. quiz_registration: my request was
// accepted or declined. quiz_host: (from Tectum) the decision on my application to conduct tests.
export const NOTIFICATION_TYPES = [
  'like', 'comment', 'follow', 'repost', 'notes_saved', 'mention', 'reply', 'quote',
  'privacy_warning', 'privacy_removed', 'message', 'verification', 'content_hidden', 'content_removed',
  'quiz_invite', 'quiz_update', 'quiz_request', 'quiz_registration', 'quiz_host',
];
const { ObjectId } = mongoose.Schema.Types;

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    sourceUser: { type: ObjectId, ref: 'User', required: true },
    post: { type: ObjectId, ref: 'Post' },
    conversation: { type: ObjectId, ref: 'Conversation' }, // message notifications: the chat to open
    isRead: { type: Boolean, default: false },
    note: { type: String, maxlength: 300 }, // Tectum's own notices: what was flagged or removed
    quiz: { type: ObjectId, ref: 'Quiz' }, // test notifications
    link: { type: String, maxlength: 200 }, // where tapping it goes (test notifications: /quiz/join?code=…)
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 }); // the unread badge count

export const Notification = mongoose.model('Notification', notificationSchema);
