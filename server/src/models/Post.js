import mongoose from 'mongoose';

export const POST_TYPES = ['text', 'case_study', 'notes'];
/** What a quick ("text") post is: a clinical pearl, a question, written study notes, or general discussion (the default). */
export const POST_KINDS = ['discussion', 'pearl', 'question', 'notes'];
/** Who may comment (X's "Who can reply?"). The author can always reply to their own post. */
/** Academic collaboration: is the author looking for co-researchers or student collaborators? */
export const COLLAB_STATUSES = ['none', 'researchers', 'students'];
export const CASE_DIFFICULTIES = ['easy', 'medium', 'hard'];
export const REPLY_POLICIES =['everyone', 'following', 'network', 'mentioned', 'verified'];
const { ObjectId } = mongoose.Schema.Types;

/** Shared by posts and comments: what the privacy check found and when it will be removed. */
export const privacyReviewSchema = new mongoose.Schema(
  { issues: { type: [String], default: [] }, flaggedAt: Date, removeAt: { type: Date, index: true } },
  { _id: false }
);

const caseStudySchema = new mongoose.Schema(
  {
    age: { type: String, trim: true, maxlength: 20 }, // e.g. "45", "40s", "6 months"; >89 stored as "90+"
    sex: { type: String, enum: ['male', 'female', 'other'] },
    chiefComplaint: { type: String, trim: true, maxlength: 1000 },
    history: { type: String, trim: true, maxlength: 4000 },
    examinationFindings: { type: String, trim: true, maxlength: 4000 },
    investigations: { type: String, trim: true, maxlength: 4000 },
    diagnosis: { type: String, trim: true, maxlength: 2000 },
    learningPoint: { type: String, trim: true, maxlength: 2000 },
    mcqTips: { type: String, trim: true, maxlength: 2000 }, // exam-oriented tips, one per line
    difficulty: { type: String, enum: CASE_DIFFICULTIES }, // how hard the case is (for filters and the badge)
    references: { type: String, trim: true, maxlength: 2000 }, // guidelines / papers, one per line (links allowed)
    // Optional "What's your diagnosis?" poll: 2-4 choices, and which one is right.
    pollOptions: { type: [{ type: String, trim: true, maxlength: 120 }], default: undefined },
    correctOption: { type: Number, min: 0, max: 3 },
  },
  { _id: false }
);

const notesFileSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
  },
  { _id: false }
);

/** Why a member reported a post, comment or profile (the app and website offer these). */
export const REPORT_REASONS = ['identifiable-patient', 'wrong-information', 'abuse', 'spam', 'other'];

/** One member's report on a post or comment (shared by both). */
export const reportSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    category: { type: String, enum: REPORT_REASONS, default: 'other' },
    reason: { type: String, trim: true, maxlength: 500, default: '' }, // the member's own words
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    author: { type: ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: POST_TYPES, default: 'text', required: true },
    kind: { type: String, enum: POST_KINDS, default: 'discussion' },
    title: { type: String, trim: true, maxlength: 200, default: '' },
    content: { type: String, trim: true, maxlength: 40000, default: '' }, // word limits enforced per member in postController
    caseStudy: { type: caseStudySchema, default: undefined },
    notesFile: { type: notesFileSchema, default: undefined },
    images: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    isSensitiveContent: { type: Boolean, default: false },
    replyPolicy: { type: String, enum: REPLY_POLICIES, default: 'everyone' },
    collab: { type: String, enum: COLLAB_STATUSES, default: 'none', index: true },    // People @mentioned in the post text (used by the "only accounts you mention" reply setting).
    mentions: { type: [{ type: ObjectId, ref: 'User' }], default: undefined },
    likes: [{ type: ObjectId, ref: 'User' }],
    reposts: [{ type: ObjectId, ref: 'User' }],
    bookmarks: [{ type: ObjectId, ref: 'User' }],
    commentCount: { type: Number, default: 0 },
    // Votes on a case's diagnosis poll: one per member, final once cast.
    pollVotes: { type: [{ user: { type: ObjectId, ref: 'User' }, option: Number, _id: false }], default: undefined },
    // Members who have worked through a case (voted or revealed the answer), for Case Rounds' "solved".
    solvedBy: { type: [{ type: ObjectId, ref: 'User' }], default: undefined },
    // Quote posts (X's "Quote"): the post being quoted, shown embedded under this post's text.
    quoteOf: { type: ObjectId, ref: 'Post', default: null, index: true },
    isQuote: { type: Boolean, default: false }, // stays true if the original is later deleted ("unavailable")
    // What was quoted: another post (quoteOf) or a comment (quoteOfComment).
    quoteKind: { type: String, enum: ['post', 'comment'], default: undefined },
    quoteOfComment: { type: ObjectId, ref: 'Comment', default: null },
    quoteCount: { type: Number, default: 0 },
    // Times the post was shown (in a feed, search or on its own page), like X's view count.
    views: { type: Number, default: 0 },
    // Notes only: members who opened or downloaded the file, counted once each (drives the library ranking).
    downloaders: { type: [{ type: ObjectId, ref: 'User' }], default: undefined },
    downloadCount: { type: Number, default: 0 },
    // Feed ranking time: createdAt, pushed forward for blue-tick authors (see utils/premium.js).
    rankAt: { type: Date, default: Date.now },
    // AI image review result (see utils/imageModeration.js). Visible to the author and admins only.
    aiReview: {
      status: { type: String, enum: ['clear', 'sensitive', 'flagged', 'unverified', 'skipped'] },
      reasons: { type: [String], default: undefined },
      model: String,
      checkedAt: Date,
    },
    // Moderation (basic): any user can flag; admins review. AI-flagged posts land here too.
    reported: { type: Boolean, default: false, index: true },
    reports: { type: [reportSchema], default: [] },
    // Hidden from everyone but its author (and admins) after enough members reported it, until a
    // moderator keeps or removes it (utils/moderation.js).
    hiddenByReports: { type: Boolean, default: false, index: true },
    // Patient privacy (utils/privacySweep.js): set when published text could identify a patient.
    // The author is warned and must edit it out before removeAt, or the post is deleted.
    privacyReview: { type: privacyReviewSchema, default: undefined },
    privacyChecked: { type: Number, default: 0, index: true }, // PRIVACY_RULES_VERSION last checked against
    // Demo content only (scripts/seed-demo): the item's fixed key, so re-running the seed never duplicates it.
    seedKey: { type: String, select: false, index: { unique: true, sparse: true } },
  },
  { timestamps: true }
);

const invalid = (message) => Object.assign(new Error(message), { status: 400 });

postSchema.pre('validate', function validateByType() {
  if (this.type === 'case_study') {
    const c = this.caseStudy;
    if (!c || !c.chiefComplaint || !c.diagnosis) {
      throw invalid('Case studies require at least a chief complaint and a diagnosis');
    }
  } else if (this.type === 'notes') {
    if (!this.notesFile?.url) throw invalid('Notes posts require an uploaded file');
  } else if (!this.content && this.images.length === 0 && !this.isQuote) {
    throw invalid('A post needs some text or an image');
  }
});

// One index per feed shape (filter fields first, then the sort):
postSchema.index({ createdAt: -1 });
postSchema.index({ rankAt: -1, _id: -1 }); // For you (ranked)
postSchema.index({ type: 1, createdAt: -1 }); // Case Rounds, Notebook tabs
postSchema.index({ type: 1, rankAt: -1, _id: -1 }); // ranked lists of one type
postSchema.index({ type: 1, commentCount: -1, createdAt: -1 }); // "most discussed" (Case of the Day, trending)
postSchema.index({ type: 1, downloadCount: -1, createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 }); // profiles, Following feed
postSchema.index({ tags: 1, createdAt: -1 }); // Wards (a Ward is a tag), tag pages
postSchema.index({ bookmarks: 1, createdAt: -1 }); // Notebook (saved posts)
postSchema.index({ reposts: 1, createdAt: -1 }); // profile Reposts tab
// Full-text search covers only a case's question side: the answer (diagnosis, learning point,
// MCQ tips) is left out so search can't give it away. syncIndexes at start-up swaps out post_text_v2.
postSchema.index(
  {
    title: 'text',
    content: 'text',
    tags: 'text',
    'caseStudy.chiefComplaint': 'text',
    'caseStudy.history': 'text',
    'caseStudy.examinationFindings': 'text',
    'caseStudy.investigations': 'text',
    'notesFile.fileName': 'text',
  },
  { name: 'post_text_v3', weights: { title: 6, tags: 5, 'caseStudy.chiefComplaint': 4, content: 3 } }
);

export const Post = mongoose.model('Post', postSchema);
