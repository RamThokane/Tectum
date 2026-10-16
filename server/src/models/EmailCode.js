import mongoose from 'mongoose';

/**
 * A 6-digit code emailed during sign-up to prove the address is real. Only its SHA-256 is kept;
 * MongoDB deletes it on its own once it expires.
 */
const emailCodeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

export const EmailCode = mongoose.model('EmailCode', emailCodeSchema);
