/**
 * Editable content for the public landing page (route "/").
 * Numbers in the trust strip come live from the database (/api/public/stats) - nothing invented.
 */

/** Trust strip: which live counts to show, and their labels. Set `show: false` to hide one. */
export const TRUST_STATS = [
  { key: 'cases', label: 'clinical cases shared', show: true },
  { key: 'wards', label: 'subject Wards', show: true },
  { key: 'specialties', label: 'specialties covered', show: true },
  { key: 'members', label: 'members', show: false }, // turn on once the community is bigger
];

/**
 * Testimonials: REAL quotes from real members only, with their permission.
 * Example: { quote: '…', name: 'Dr. A. Sharma', role: 'Intern, AIIMS Delhi' }
 * While this list is empty the section invites members to share their story instead.
 */
export const TESTIMONIALS = [];

/** Social links in the footer. Leave a value empty to hide that icon. */
export const SOCIAL = {
  instagram: '',
  linkedin: '',
  x: '',
  youtube: '',
  email: 'medtectum@gmail.com',
};

export const FAQ = [
  {
    q: 'Is Tectum free?',
    a: 'Yes. Solving cases, joining Wards, discussing and revising flashcards are all free. An optional one-time blue tick (for verified members) gives your posts a little more reach and removes ads.',
  },
  {
    q: 'Is patient data safe?',
    a: 'Cases must be de-identified: no names, dates, hospital numbers or faces. Authors confirm this and patient consent before posting, photo location data is removed automatically, and members can report anything that slips through. We follow India’s Digital Personal Data Protection Act, 2023.',
  },
  {
    q: 'Who can post cases?',
    a: 'Any member can share a case or a pearl. Every case shows who posted it and their role (student, doctor, nurse), and verified clinicians carry a tick so you know whose experience you’re learning from.',
  },
  {
    q: 'How is verification done?',
    a: 'Doctors upload their medical council registration and students their college ID. Our team checks the document by hand, and the document is never shown publicly.',
  },
  {
    q: 'Is this medical advice?',
    a: 'No. Tectum is for education and peer discussion between healthcare learners and professionals. It is not a substitute for clinical judgement or for patients seeking care.',
  },
];
