/**
 * Medical and health-science courses offered at sign-up, grouped for the dropdown.
 * Keep the `value`s in sync with server/src/data/courses.js.
 */
export const COURSE_GROUPS = [
  {
    label: 'Medicine & dentistry',
    options: [
      ['mbbs', 'MBBS'],
      ['bds', 'BDS (Dental)'],
    ],
  },
  {
    label: 'AYUSH',
    options: [
      ['bams', 'BAMS (Ayurveda)'],
      ['bhms', 'BHMS (Homoeopathy)'],
      ['bums', 'BUMS (Unani)'],
      ['bsms', 'BSMS (Siddha)'],
      ['bnys', 'BNYS (Naturopathy & Yoga)'],
    ],
  },
  {
    label: 'Nursing',
    options: [
      ['bsc-nursing', 'B.Sc Nursing'],
      ['post-basic-nursing', 'Post Basic B.Sc Nursing'],
      ['gnm', 'GNM'],
      ['anm', 'ANM'],
      ['msc-nursing', 'M.Sc Nursing'],
    ],
  },
  {
    label: 'Physiotherapy, pharmacy & allied health',
    options: [
      ['bpt', 'BPT / BPTh (Physiotherapy)'],
      ['bot', 'BOT (Occupational Therapy)'],
      ['bpharm', 'B.Pharm'],
      ['dpharm', 'D.Pharm'],
      ['pharmd', 'Pharm.D'],
      ['bmlt', 'BMLT / B.Sc MLT (Lab Technology)'],
      ['bsc-allied', 'B.Sc Allied Health (Radiology, OT, Dialysis, etc.)'],
      ['baslp', 'BASLP (Audiology & Speech)'],
      ['boptom', 'B.Optom (Optometry)'],
      ['bsc-nutrition', 'B.Sc Nutrition & Dietetics'],
      ['bph', 'BPH / MPH (Public Health)'],
    ],
  },
  {
    label: 'Postgraduate (PG) & super-specialty',
    options: [
      ['md', 'MD'],
      ['ms', 'MS'],
      ['dnb', 'DNB'],
      ['mds', 'MDS (Dental PG)'],
      ['md-ayush', 'MD / MS (AYUSH)'],
      ['dm-mch', 'DM / MCh (Super-specialty)'],
      ['pg-diploma', 'PG Diploma'],
      ['mpt', 'MPT (Physiotherapy PG)'],
      ['mpharm', 'M.Pharm'],
      ['msc-medical', 'M.Sc (Medical / Allied)'],
      ['fellowship', 'Fellowship'],
      ['phd', 'PhD'],
    ],
  },
  {
    label: 'Other',
    options: [
      ['intl-md', 'MD (International, e.g. USA / abroad)'],
      ['other', 'Other'],
    ],
  },
];

/**
 * Which courses make sense for each role (the role is asked first, then only these are offered).
 * Students and researchers see everything; "other" (Other role) is always allowed.
 */
const DOCTOR = ['mbbs', 'bds', 'bams', 'bhms', 'bums', 'bsms', 'bnys', 'md', 'ms', 'dnb', 'mds', 'md-ayush', 'dm-mch', 'pg-diploma', 'fellowship', 'phd', 'intl-md'];
const NURSE = ['bsc-nursing', 'post-basic-nursing', 'gnm', 'anm', 'msc-nursing', 'phd'];
const ALLIED = ['bpt', 'bot', 'bpharm', 'dpharm', 'pharmd', 'bmlt', 'bsc-allied', 'baslp', 'boptom', 'bsc-nutrition', 'bph', 'mpt', 'mpharm', 'msc-medical', 'pg-diploma', 'fellowship', 'phd'];
const ROLE_COURSES = { doctor: DOCTOR, nurse: NURSE, other: ALLIED };

/** Course groups for a role, with empty groups dropped (every role keeps "Other"). */
export function coursesForRole(role) {
  const allowed = ROLE_COURSES[role];
  if (!allowed) return COURSE_GROUPS; // student, researcher, or not chosen yet
  const keep = new Set([...allowed, 'other']);
  return COURSE_GROUPS.map((g) => ({ ...g, options: g.options.filter(([v]) => keep.has(v)) })).filter((g) => g.options.length);
}

/** Whether a course is on offer for a role (used to reset the course when the role changes). */
export const courseFitsRole = (course, role) => !course || coursesForRole(role).some((g) => g.options.some(([v]) => v === course));

const BY_VALUE = new Map(COURSE_GROUPS.flatMap((g) => g.options));
/** "mbbs" -> "MBBS" (short label, without the explanation in brackets). */
export const courseLabel = (value) => (BY_VALUE.get(value) ?? '').replace(/\s*\(.*\)$/, '');
