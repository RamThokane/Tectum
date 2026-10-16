export const AUTHOR_FIELDS = 'name username role designation yearLabel verificationStatus isPremium isOfficial profilePicture specialtyTags institution';

const includesId = (arr = [], id) => arr.some((x) => String(x) === String(id));

/** A case's answer side: kept out of search and out of API responses until the viewer has revealed or voted. */
export const CASE_ANSWER_FIELDS = ['diagnosis', 'learningPoint', 'mcqTips', 'references', 'correctOption'];

/** Just the answer side of a case (for the reveal and vote responses). */
export const caseAnswers = (caseStudy = {}) => Object.fromEntries(CASE_ANSWER_FIELDS.filter((k) => caseStudy[k] !== undefined).map((k) => [k, caseStudy[k]]));

/**
 * Turns a Post doc into an API shape: counts + viewer flags instead of raw user-id arrays.
 * `viewer` is the signed-in user (or just their id). A case's answers are included only for its
 * author, admins, members who revealed or voted, or when `showAnswers` is set (the Notebook deck).
 */
export function serializePost(post, viewer, { showAnswers = false } = {}) {
  const viewerId = viewer?._id ?? viewer;
  const o = typeof post.toObject === 'function' ? post.toObject() : post;
  const { likes = [], reposts = [], bookmarks = [], reports: _reports, reported: _reported, rankAt: _rankAt, aiReview: _ai, downloaders: _downloaders, pollVotes = [], solvedBy = [], privacyChecked: _pc, seedKey: _sk, __v, ...rest } = o;
  // Diagnosis poll: totals per option and this viewer's own vote (never who voted what).
  const options = rest.caseStudy?.pollOptions ?? [];
  const poll = options.length
    ? {
        counts: options.map((_, i) => pollVotes.filter((v) => v.option === i).length),
        total: pollVotes.length,
        myVote: pollVotes.find((v) => String(v.user) === String(viewerId))?.option ?? null,
      }
    : undefined;
  let caseFields = {};
  if (rest.type === 'case_study') {
    // Has this viewer worked through it (voted on the poll or revealed the answer)?
    const solved = includesId(solvedBy, viewerId) || poll?.myVote != null;
    const isAuthor = viewerId != null && String(rest.author?._id ?? rest.author) === String(viewerId);
    const unlocked = solved || isAuthor || !!viewer?.isAdmin || showAnswers;
    caseFields = { solved, answersHidden: !unlocked };
    if (!unlocked && rest.caseStudy) {
      rest.caseStudy = Object.fromEntries(Object.entries(rest.caseStudy).filter(([k]) => !CASE_ANSWER_FIELDS.includes(k)));
    }
  }
  return {
    ...rest,
    poll,
    ...caseFields,
    likeCount: likes.length,
    repostCount: reposts.length,
    bookmarkCount: bookmarks.length,
    liked: includesId(likes, viewerId),
    reposted: includesId(reposts, viewerId),
    bookmarked: includesId(bookmarks, viewerId),
  };
}

/** Comment API shape: counts + "did I…" flags instead of the raw user-id arrays. */
export function serializeComment(comment, viewerId) {
  const o = typeof comment.toObject === 'function' ? comment.toObject() : comment;
  const { likes = [], reposts = [], bookmarks = [], privacyChecked: _pc, reports: _r, reported: _rd, __v, ...rest } = o;
  return {
    ...rest,
    views: rest.views ?? 0,
    likeCount: likes.length,
    repostCount: reposts.length,
    bookmarkCount: bookmarks.length,
    liked: includesId(likes, viewerId),
    reposted: includesId(reposts, viewerId),
    bookmarked: includesId(bookmarks, viewerId),
  };
}

/** Shortens text to at most `max` characters at a word boundary, adding "…" (never cuts mid-word). */
export function truncateWords(text = '', max = 120) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : clean.slice(0, max)).replace(/[\s,;:.\-–—]+$/, '');
  return `${base}…`;
}

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const normalizeTag = (t) => t.trim().replace(/^#+/, '').toLowerCase();
