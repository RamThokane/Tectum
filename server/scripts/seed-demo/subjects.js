import { WARDS } from '../../src/data/wards.js';

/**
 * NEET-PG subjects (CBME pattern) and which MBBS year studies them. Matched against the app's
 * Ward list (src/data/wards.js, the source of truth), never created: a subject with no Ward is
 * reported as missing. Only medicine-group Wards are considered (so "Obstetric Nursing" is not OBG).
 */
export const SUBJECTS = [
  { subject: 'Anatomy', year: 'first', priority: true, match: /^anatomy$/ },
  { subject: 'Physiology', year: 'first', priority: true, match: /^physiology$/ },
  { subject: 'Biochemistry', year: 'first', priority: true, match: /^biochemistry$/ },
  { subject: 'Pathology', year: 'second', priority: true, match: /^pathology$/ },
  { subject: 'Pharmacology', year: 'second', priority: true, match: /^pharmacology$/ },
  { subject: 'Microbiology', year: 'second', priority: true, match: /^microbiology$/ },
  { subject: 'Forensic Medicine', year: 'second', priority: true, match: /forensic|toxicology/ },
  { subject: 'Medicine', year: 'final', priority: true, match: /^(internal-)?medicine$/ },
  { subject: 'Surgery', year: 'final', priority: true, match: /^(general-)?surgery$/ },
  { subject: 'OBG', year: 'final', priority: true, match: /^(obgyn|obg|obstetrics.*)$/ },
  { subject: 'Pediatrics', year: 'final', priority: true, match: /^paediatrics$|^pediatrics$/ },
  { subject: 'ENT', year: 'final', priority: true, match: /^ent$/ },
  { subject: 'Ophthalmology', year: 'final', priority: true, match: /^ophthalmology$/ },
  { subject: 'Community Medicine / PSM', year: 'final', priority: true, match: /^(community-medicine|psm|public-health)$/ },
  // Smaller NEET-PG subjects: seeded with fewer items.
  { subject: 'Orthopaedics', year: 'final', priority: false, match: /^orthopa?edics$/ },
  { subject: 'Dermatology', year: 'final', priority: false, match: /^dermatology$/ },
  { subject: 'Psychiatry', year: 'final', priority: false, match: /^psychiatry$/ },
  { subject: 'Anaesthesiology', year: 'final', priority: false, match: /^ana?esthesiology$/ },
  { subject: 'Radiology', year: 'final', priority: false, match: /^radiology$/ },
];

/** Reads the Wards and maps each subject to one: { found: [{...subject, slug, label}], missing: [subject names] }. */
export function mapSubjectsToWards() {
  const medicine = WARDS.filter((w) => w.group === 'medicine');
  const found = [];
  const missing = [];
  for (const s of SUBJECTS) {
    const ward = medicine.find((w) => s.match.test(w.slug));
    if (ward) found.push({ ...s, slug: ward.slug, label: ward.label });
    else missing.push(s.subject);
  }
  return { found, missing, allWards: WARDS };
}

export const YEAR_NAMES = { first: '1st year', second: '2nd year', final: 'Final year', intern: 'Intern / NEET-PG' };
