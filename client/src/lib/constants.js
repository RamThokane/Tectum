export const ROLES = [
  { value: 'student', label: 'Medical Student', short: 'Student', blurb: 'Studying medicine, nursing or allied health' },
  { value: 'doctor', label: 'Doctor', short: 'Doctor', blurb: 'Physicians, residents and surgeons' },
  { value: 'nurse', label: 'Nurse', short: 'Nurse', blurb: 'Registered nurses, NPs and midwives' },
  { value: 'researcher', label: 'Researcher', short: 'Researcher', blurb: 'Clinical and biomedical research' },
  { value: 'other', label: 'Other Healthcare Professional', short: 'Healthcare', blurb: 'Pharmacists, therapists, paramedics…' },
];

export const roleLabel = (role) => ROLES.find((r) => r.value === role)?.short ?? 'Member';

/** What shows next to someone's name: their designation (e.g. "Cardiologist") if they added one, else their role. */
// Official Tectum accounts (e.g. "Tectum Team") say "Official" instead of a role.
// Students show their year line instead ("Final Year MBBS", "NEET-PG 2027 aspirant") when they set one.
export const userTitle = (user) =>
  user?.isOfficial
    ? 'Official'
    : user?.designation?.trim() || (user?.role === 'student' && user?.yearLabel?.trim()) || roleLabel(user?.role);

/** Specialist doctors: picked in the Role list, shown as the badge instead of "Doctor". */
export const SPECIALIST_TITLES = [
  'Anaesthesiologist', 'Cardiologist', 'Cardiothoracic Surgeon', 'Dermatologist', 'Emergency Physician', 'Endocrinologist',
  'ENT Surgeon', 'Family Physician', 'Gastroenterologist', 'General Surgeon', 'Gynaecologist', 'Haematologist', 'Intensivist',
  'Microbiologist', 'Neonatologist', 'Nephrologist', 'Neurologist', 'Neurosurgeon', 'Obstetrician', 'Oncologist',
  'Ophthalmologist', 'Orthopaedic Surgeon', 'Paediatrician', 'Pathologist', 'Physician', 'Plastic Surgeon', 'Psychiatrist',
  'Public Health Specialist', 'Pulmonologist', 'Radiologist', 'Rheumatologist', 'Urologist',
];

/** PG degrees, also offered in the Role list for doctors. */
export const PG_DEGREES = [
  'MD General Medicine', 'MD Paediatrics', 'MD Anaesthesia', 'MD Radiology', 'MD Pathology', 'MD Psychiatry', 'MD Dermatology',
  'MD Community Medicine', 'MS General Surgery', 'MS Orthopaedics', 'MS OBGYN', 'MS ENT', 'MS Ophthalmology', 'DM Cardiology',
  'DM Neurology', 'DM Gastroenterology', 'DM Nephrology', 'MCh Neurosurgery', 'MCh Urology', 'DNB', 'Senior Resident', 'Consultant',
];

export const DESIGNATIONS = [...SPECIALIST_TITLES, ...PG_DEGREES];

export const SPECIALTIES = [
  'anatomy', 'physiology', 'biochemistry', 'pharmacology', 'pathology', 'microbiology',
  'internal-medicine', 'cardiology', 'neurology', 'pulmonology', 'gastroenterology', 'nephrology',
  'endocrinology', 'hematology', 'oncology', 'infectious-disease', 'emergency-medicine',
  'critical-care', 'surgery', 'orthopedics', 'pediatrics', 'obgyn', 'psychiatry', 'dermatology',
  'radiology', 'anesthesiology', 'ophthalmology', 'ent', 'family-medicine', 'public-health',
  'nursing', 'research',
];

export const prettyTag = (t) => t.replace(/-/g, ' ');


export const MAX_SAVED_ACCOUNTS_HINT = 'You can keep up to 5 accounts on one browser. Remove one to add another.';

// Posting limits (the server enforces the same values).
export const MAX_POST_WORDS = 500;
export const MAX_POST_WORDS_BLUE = 5000; // blue tick members
// Quick Post word limit for this member.
export const postWordLimit = (user) =>
  user?.verificationStatus === 'verified' ? MAX_POST_WORDS_BLUE : MAX_POST_WORDS;
export const MAX_IMAGE_MB = 5;
export const countWords = (s = '') => (s.trim() ? s.trim().split(/\s+/).length : 0);

export const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif';
export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png';

export const SEX_OPTIONS = [
  { value: 'male', label: 'Male', short: 'M' },
  { value: 'female', label: 'Female', short: 'F' },
  { value: 'other', label: 'Other', short: 'Other' },
];

/** "45 · Male" style summary for a case's age/sex (empty string if neither is set). */
export const ageSexLabel = (cs = {}, { short = false } = {}) => {
  const sex = SEX_OPTIONS.find((s) => s.value === cs.sex);
  const age = cs.age ? (/^\d+$/.test(cs.age) ? `${cs.age} y` : cs.age) : '';
  return [age, sex && (short ? sex.short : sex.label)].filter(Boolean).join(' · ');
};

export const CASE_FIELDS = [
  { key: 'chiefComplaint', label: 'Chief complaint', required: true, rows: 2, placeholder: 'e.g. 3-day history of progressive shortness of breath' },
  { key: 'history', label: 'History', rows: 4, placeholder: 'Presenting complaint, PMH, medications, social history (age range & sex only - no names or dates)' },
  { key: 'examinationFindings', label: 'Examination findings', rows: 3, placeholder: 'Vitals and relevant findings' },
  { key: 'investigations', label: 'Investigations', rows: 3, placeholder: 'Labs, imaging, ECG…' },
  { key: 'diagnosis', label: 'Diagnosis', required: true, rows: 2, placeholder: 'Final or working diagnosis' },
  { key: 'learningPoint', label: 'Learning point', rows: 2, placeholder: 'The one thing you want others to take away' },
  { key: 'references', label: 'References', rows: 2, placeholder: 'Guidelines or papers backing the answer, one per line (links welcome)' },
];

