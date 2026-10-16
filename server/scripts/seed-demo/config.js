/**
 * Demo seed settings: every number from the brief lives here. Change, then re-run the seed.
 * (Top Contributors' formula, window and HIDE_DEMO_IN_RANKINGS live in src/utils/rankings.js,
 * because the app itself uses them.)
 */
export const CONFIG = {
  // Random seed: same value = same people, same authors, same likes on every run.
  SEED: 'tectum-demo-2026',

  // ---- accounts ----
  ACCOUNT_COUNT: 100,
  EMAIL_PATTERN: (n) => `demo+${String(n).padStart(3, '0')}@tectum.co.in`,
  YEAR_SPLIT: { first: 27, second: 27, final: 26, intern: 20 }, // must add up to ACCOUNT_COUNT
  FEMALE_SHARE: 0.5,
  REGION_SPLIT: { north: 0.3, west: 0.27, south: 0.25, east: 0.18 }, // where the names come from
  SAME_REGION_COLLEGE: 0.8, // share studying in their own region
  MAX_PER_MID_COLLEGE: 4,
  MAX_TOP_COLLEGE_ACCOUNTS: 8, // in total
  MAX_PER_TOP_COLLEGE: 1,
  JOINED_DAYS_AGO: [90, 180], // join dates: 3-6 months ago
  BIO_EMPTY_SHARE: 0.18,

  // ---- activity (items each account writes) ----
  // The brief asks for a few 30+ accounts, most 5-15 and some 1-4, but the total content
  // (~329 items) can't give most of 100 accounts 5+ once a few have 30. These weights share it
  // out as: a few very active, a middle group, and many quiet ones (everyone gets at least 1).
  ACTIVITY_TIERS: [
    { name: 'power', count: 4, weight: 160 },
    { name: 'active', count: 22, weight: 6 },
    { name: 'regular', count: 34, weight: 1.6 },
    { name: 'quiet', count: 40, weight: 0.4 },
  ],
  HOME_WARDS_PER_ACCOUNT: [2, 4], // power accounts always get the maximum
  // Each item an author already has in a Ward multiplies their chance of the next one by this,
  // so even very active accounts leave room for many others in every Ward.
  SAME_WARD_DECAY: 0.88,
  MAX_SHARE_PER_WARD: 0.45, // nobody writes more than 45% of a Ward's items
  MIN_AUTHORS_PER_WARD: 6, // content in every Ward comes from at least this many people

  // ---- content per Ward ----
  // Priority Wards use the high range, other seeded Wards the low range. The real numbers come
  // from how many items each Ward's content file holds (written within these ranges and
  // checked by --check so no two Wards have the same combination).
  // (posts 9-12 x cases 8-10 gives only 12 different combinations for 13 priority Wards, so
  // priority cases may go down to 7; other Wards may have up to 9 posts for the same reason.)
  POSTS_PER_WARD: { priority: [9, 12], other: [7, 9] },
  CASES_PER_WARD: { priority: [7, 10], other: [7, 8] }, // every case carries a 4-option poll

  // ---- timing ----
  CONTENT_DAYS_AGO: [0, 90], // created_at spread over the last 90 days...
  RECENT_BIAS: 2.4, // ...leaning to recent (>1 = more recent; 2.4 puts ~60% in the last 30 days), so every Ward has a top 5
  // Posting-time habits (IST hours, 24h; 24-25 = after midnight).
  TIME_PATTERNS: {
    morning: [6.5, 10.5],
    afternoon: [13, 17],
    evening: [18, 22.5],
    night: [21.5, 25],
    mixed: [7, 25],
  },

  // ---- likes ----
  LIKES_PER_ITEM: [5, 10],
  SAME_YEAR_LIKER_SHARE: 0.7, // likers mostly from the same year / Ward
  LIKER_WEIGHTS: [0.3, 3], // some accounts like a lot, some rarely

  // ---- batches ----
  BATCH_SIZE: 50,

  // ---- output ----
  CSV_PATH: 'demo-review.csv', // written in server/, for the medical review
};
