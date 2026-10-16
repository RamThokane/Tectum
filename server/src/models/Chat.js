import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

/**
 * End-to-end encrypted direct messages.
 *
 * The server never sees message text or anyone's private key:
 *  - ChatKey holds a member's PUBLIC key (shared with the people they chat with) and a backup of
 *    their PRIVATE key that the browser encrypted with the member's chat passphrase before upload.
 *  - Message holds only ciphertext + IV produced in the sender's browser (AES-GCM with a key
 *    derived by ECDH between the two members' keys).
 */
const chatKeySchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, unique: true },
    keyId: { type: String, required: true }, // fingerprint of the public key; changes if the member resets
    publicKey: { type: String, required: true, maxlength: 2000 }, // JWK (ECDH P-256), JSON string
    // Private-key backup, encrypted client-side (PBKDF2-SHA256 -> AES-GCM). Opaque to the server.
    encPrivateKey: { type: String, required: true, maxlength: 4000 },
    salt: { type: String, required: true, maxlength: 100 },
    iv: { type: String, required: true, maxlength: 100 },
    iterations: { type: Number, required: true },
  },
  { timestamps: true }
);

const conversationSchema = new mongoose.Schema(
  {
    // Always exactly two members, stored sorted so each pair has one conversation.
    members: { type: [{ type: ObjectId, ref: 'User' }], required: true },
    pairKey: { type: String, required: true, unique: true }, // "<smallerId>:<largerId>"
    lastMessageAt: { type: Date, default: null },
    lastSender: { type: ObjectId, ref: 'User', default: null },
    // Messages each member hasn't read yet, keyed by user id.
    unread: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);
conversationSchema.index({ members: 1, lastMessageAt: -1 });

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: ObjectId, ref: 'Conversation', required: true },
    sender: { type: ObjectId, ref: 'User', required: true },
    ciphertext: { type: String, required: true, maxlength: 20000 }, // base64
    iv: { type: String, required: true, maxlength: 64 }, // base64
    // Which keys it was encrypted between, so a reset key shows "can't be decrypted" instead of garbage.
    senderKeyId: { type: String, required: true },
    recipientKeyId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
messageSchema.index({ conversation: 1, createdAt: -1 });

export const ChatKey = mongoose.model('ChatKey', chatKeySchema);
export const Conversation = mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.model('Message', messageSchema);
