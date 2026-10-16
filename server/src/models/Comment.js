import mongoose from 'mongoose';
import { privacyReviewSchema, reportSchema } from './Post.js';

const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    // Replies point at a top-level comment (one level deep); null for top-level comments.
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null, index: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reposts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    views: { type: Number, default: 0 },
    quoteCount: { type: Number, default: 0 }, // posts quoting this comment // times the comment was shown on its post's page
    // Patient privacy (utils/privacySweep.js): same as on posts.
    privacyReview: { type: privacyReviewSchema, default: undefined },
    privacyChecked: { type: Number, default: 0, index: true },
    // Member reports, as on posts (utils/moderation.js): in the moderators' queue, hidden after enough.
    reports: { type: [reportSchema], default: undefined },
    reported: { type: Boolean, default: false, index: true },
    hiddenByReports: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

commentSchema.index({ post: 1, createdAt: 1 });

export const Comment = mongoose.model('Comment', commentSchema);
