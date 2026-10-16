/**
 * Details used across the legal pages (Terms, Privacy, Guidelines, Advertising, Grievance).
 * Anything still in [square brackets] shows highlighted on the site until it is filled in.
 * TERMS_VERSION must match server/src/validators.js.
 */
export const TERMS_VERSION = '2026-09-30';
export const LAST_UPDATED = '30 September 2026';

export const LEGAL = {
  // Who runs Tectum: your full legal name (sole proprietor) or your registered company name.
  operator: 'Tectum',
  address: 'Mumbai, Maharashtra, India',
  city: 'Mumbai, Maharashtra', // courts with jurisdiction
  email: 'medtectum@gmail.com',
  grievanceOfficer: 'Grievance Officer, Tectum',
  grievanceEmail: 'medtectum@gmail.com',
};

export const LEGAL_DOCS = [
  { slug: 'terms', title: 'Terms of Service' },
  { slug: 'privacy', title: 'Privacy Policy' },
  { slug: 'guidelines', title: 'Community Guidelines' },
  { slug: 'advertising', title: 'Advertising Policy' },
  { slug: 'grievance', title: 'Grievance Officer & Contact' },
];
