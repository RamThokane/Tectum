import { BookOpen, Hospital, Presentation, Award } from 'lucide-react';

/** "2024-05" → "May 2024", "2024" → "2024". */
export function fmtYM(v) {
  if (!v) return '';
  const [y, m] = v.split('-');
  if (!m) return y;
  return new Date(Date.UTC(+y, +m - 1, 1)).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** A URL, DOI or PubMed ID → a link people can open (or null). */
export function refHref(v) {
  const s = (v || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^10\.\d{4,9}\/\S+$/.test(s)) return `https://doi.org/${s}`;
  const pmid = s.match(/^(?:pmid:?\s*)?(\d{4,9})$/i);
  if (pmid) return `https://pubmed.ncbi.nlm.nih.gov/${pmid[1]}/`;
  return null;
}
export const refLabel = (v) => {
  const s = (v || '').trim();
  if (/^10\./.test(s)) return `DOI ${s}`;
  if (/^(pmid:?\s*)?\d{4,9}$/i.test(s)) return `PMID ${s.replace(/\D/g, '')}`;
  return 'View';
};

const range = (from, to) => [fmtYM(from), to ? fmtYM(to) : from ? 'Present' : ''].filter(Boolean).join(' – ');

/**
 * The four portfolio sections: their form fields and how one entry reads (title line, detail
 * line, date, link). Used by the profile tab and the Medical CV.
 */
export const PORTFOLIO_SECTIONS = [
  {
    key: 'publications',
    title: 'Publications & research papers',
    short: 'Publication',
    icon: BookOpen,
    tint: 'bg-ds-brand-soft text-ds-brand-text',
    fields: [
      { name: 'title', label: 'Title', required: true, placeholder: 'e.g. Outcomes of early PCI in inferior STEMI with RV involvement' },
      { name: 'journal', label: 'Journal', placeholder: 'e.g. Indian Heart Journal' },
      { name: 'link', label: 'PubMed ID, DOI or link', placeholder: 'e.g. 34567890, 10.1016/j.ihj.2024.01.002 or https://…' },
      { name: 'date', label: 'Publication date', type: 'month' },
    ],
    read: (e) => ({ title: e.title, detail: e.journal, date: fmtYM(e.date), link: e.link }),
  },
  {
    key: 'electives',
    title: 'Clinical electives & rotations',
    short: 'Elective / rotation',
    icon: Hospital,
    tint: 'bg-ds-brand-soft text-ds-brand-text',
    fields: [
      { name: 'institution', label: 'Hospital / institution', required: true, placeholder: 'e.g. AIIMS New Delhi' },
      { name: 'department', label: 'Department', placeholder: 'e.g. Cardiology' },
      { name: 'role', label: 'Role', placeholder: 'e.g. Elective student, Junior Resident' },
      { name: 'from', label: 'From', type: 'month' },
      { name: 'to', label: 'To', type: 'month', hint: 'Leave empty if ongoing' },
    ],
    read: (e) => ({ title: [e.department, e.institution].filter(Boolean).join(' · '), detail: e.role, date: range(e.from, e.to) }),
  },
  {
    key: 'presentations',
    title: 'Conference presentations',
    short: 'Presentation',
    icon: Presentation,
    tint: 'bg-info-soft text-info',
    fields: [
      { name: 'conference', label: 'Conference', required: true, placeholder: 'e.g. CSI Annual Conference' },
      { name: 'type', label: 'Presentation type', type: 'select', options: [['poster', 'Poster'], ['oral', 'Oral']] },
      { name: 'title', label: 'Title', placeholder: 'Title of your talk or poster' },
      { name: 'location', label: 'Location', placeholder: 'e.g. Mumbai' },
      { name: 'year', label: 'Year', type: 'month' },
    ],
    read: (e) => ({
      title: e.title || e.conference,
      detail: [e.type === 'oral' ? 'Oral presentation' : 'Poster', e.title ? e.conference : '', e.location].filter(Boolean).join(' · '),
      date: fmtYM(e.year),
    }),
  },
  {
    key: 'certifications',
    title: 'Certifications',
    short: 'Certification',
    icon: Award,
    tint: 'bg-warning-soft text-warning',
    fields: [
      { name: 'name', label: 'Certification', required: true, placeholder: 'e.g. BLS, ACLS, MRCP Part 1' },
      { name: 'issuer', label: 'Issuing body', placeholder: 'e.g. American Heart Association' },
      { name: 'validUntil', label: 'Valid until', type: 'month' },
      { name: 'link', label: 'Verification link', placeholder: 'https://…' },
    ],
    read: (e) => ({ title: e.name, detail: e.issuer, date: e.validUntil ? `Valid until ${fmtYM(e.validUntil)}` : '', link: e.link }),
  },
];

export const portfolioCount = (p) => PORTFOLIO_SECTIONS.reduce((n, s) => n + (p?.[s.key]?.length ?? 0), 0);
