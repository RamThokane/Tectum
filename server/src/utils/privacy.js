// Patient-privacy check for posts, cases and comments.
// Identical copies live in client/src/lib/privacy.js and server/src/utils/privacy.js - keep them in sync.
//
// It finds two things:
//   - 'identifier': text that could reveal who a patient is (names, bed numbers, hospital
//     names, record numbers, phone numbers, Aadhaar, exact dates...)
//   - 'request': text that asks someone else for a patient's identity ("what's her name?")
// It is a safety net that catches common patterns, not a guarantee.

const HOSPITAL_WORDS = '(?:Hospitals?|Clinic|Nursing Home|Medical College|Medical Cent(?:re|er)|Infirmary|Health Cent(?:re|er)|Polyclinic|Dispensary)';
// Generic facility types that don't name one place ("a district hospital" is fine).
const GENERIC = /^(?:a|an|the|our|my|this|that|local|district|civil|general|government|govt\.?|tertiary|teaching|private|rural|urban|community|primary|referral|sub|small|big|large|nearby|another|same|mission|trust|state|city|municipal|and|care|dental|eye|children's|women's|maternity|cancer|psychiatric|mental|heart|kidney|care)$/i;

// Bump when the rules change: the server then re-checks every published post and comment once.
export const PRIVACY_RULES_VERSION = 2;

// Words that come before an age but aren't a name ("female aged 45", "patient age 14").
const NOT_A_NAME = new Set(
  ('patient pt the a an this that our my his her their male female boy girl child man woman lady gentleman old year years ' +
    'yr yrs at of with and is was mother father son daughter wife husband baby infant adult elderly case known presented ' +
    'presents history since for from previously healthy diabetic hypertensive smoker farmer student teacher driver worker ' +
    'labourer laborer housewife retired young middle elder mean median average gestational maternal paternal who when ' +
    'onset death diagnosis in on to by as be are were been had has have age aged sex').split(' ')
);

const LIVES_PREFIX = /^(?:resident of|residing (?:at|in)|resides (?:at|in)|r\/o|native of|hails from|lives (?:at|in)|living (?:at|in))\s+/i;

const IDENTIFIERS = [
  { label: 'an email address', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { label: 'an Aadhaar number', re: /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g },
  { label: 'a phone number', re: /(?:\+91[\s-]?|\b0?)[6-9]\d{4}[\s-]?\d{5}\b/g },
  { label: 'a phone number', re: /(?:\+?\d{1,2}[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g },
  { label: 'a Social Security number', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    label: 'a hospital record number',
    re: /\b(?:MRN|UHID|CR\s*No|IP\s*No|IPD\s*No|OPD\s*No|Reg(?:istration)?\.?\s*No|Hospital\s*(?:No|Number|ID)|Patient\s*ID|Medical\s+record\s+(?:no|number|#)|Aadhaa?r(?:\s*(?:no|number))?)\.?\s*[:#-]?\s*(?=[A-Z0-9/-]*\d)[A-Z0-9][A-Z0-9/-]{2,}/gi,
  },
  { label: 'a bed or room number', re: /\b(?:bed|room|cabin|cubicle|bay|ward)\s*(?:no\.?|number|#)?\s*[:#-]?\s*\d{1,4}[A-Z]?\b/gi },
  { label: 'a hospital name', re: /\b(?:St\.?|Saint)\s+[A-Z][a-z]+(?:'s|’s|s')?(?:\s+[A-Z][a-z]+)*/g },
  {
    label: 'a hospital name',
    re: new RegExp(`\\b(?:[A-Z][\\w'’.&-]*\\s+){1,4}${HOSPITAL_WORDS}\\b`, 'g'),
    keep: (m) => !m.split(/\s+/).slice(0, -1).every((w) => GENERIC.test(w) || /^(?:Hospitals?|Clinic|Nursing|Home|Medical|College|Health)$/.test(w)),
  },
  { label: 'a hospital name', re: /\b(?:AIIMS|PGIMER|JIPMER|NIMHANS|KEM|CMC Vellore|Safdarjung|Apollo|Fortis|Manipal|Medanta|Narayana|Max Hospital)\b/g },
  { label: 'a name', re: /\b(?:Mr|Mrs|Ms|Mst|Miss|Master|Shri|Sri|Smt|Kumari|Kum)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g },
  {
    label: 'a name',
    re: /\b(?:(?:patient|pt|his|her|their|the child's|the baby's)(?:'s)?\s+name\s*(?:is|was|:|-)|named|name\s*:)\s*[A-Za-z][a-z]+(?:\s+[A-Z][a-z]+)?/gi,
    keep: (m) => {
      const [, before, who] = m.match(/^(.*?(?:\bis|\bwas|:|-|named))\s*(.*)$/i) ?? [];
      if (!who || /^(?:unknown|not|withheld|redacted|removed|hidden|anonymous|confidential)\b/i.test(who)) return false;
      // "named Ravi" needs a capital letter; "named after", "named as" are ordinary English.
      return /named$/i.test(before) ? /^[A-Z]/.test(who) && !/^(?:After|As|In|By|For)\b/.test(who) : true;
    },
    // "Suresh and" -> "Suresh": a capitalised first name isn't followed by a lower-case surname.
    trim: (m) => m.replace(/(\b[A-Z][a-z]+)\s+[a-z]+$/, '$1'),
  },
  {
    // "suresh kumar age 14", "Ravi aged 45" - a name right before the age (any capitals).
    label: 'a name',
    re: /\b[A-Za-z][a-z]{2,}(?:\s+[A-Za-z][a-z]{2,})?,?\s+(?=aged?\b\s*[:-]?\s*\d)/gi,
    keep: (m) => !m.split(/[\s,]+/).filter(Boolean).some((w) => NOT_A_NAME.has(w.toLowerCase())),
    trim: (m) => m.replace(/[\s,]+$/, ''),
  },
  // "Ravi Kumar, 45 yrs" - a capitalised first name and surname, then a comma and an age.
  { label: 'a name', re: /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?=,\s*\d{1,3}\s*(?:y|yrs?|years?|yo|y\/o)\b(?!\s*(?:duration|ago|back|history|since|prior)\b))/g, keep: (m) => !m.split(/\s+/).some((w) => NOT_A_NAME.has(w.toLowerCase())) },
  {
    // "resident of byculla, mumbai", "r/o Andheri", "lives in Pune" - where the patient lives.
    label: 'where the patient lives',
    re: /\b(?:resident of|residing (?:at|in)|resides (?:at|in)|r\/o|native of|hails from|lives (?:at|in)|living (?:at|in))\s+[A-Za-z][\w.'-]*(?:,?\s+(?!(?:with|and|who|since|for|presented|presents|came|comes|complain\w*|c\/o|has|had|is|was|he|she|the|a|an|on|at|in|to|by|of|now|currently)\b)[A-Za-z][\w.'-]*){0,2}/gi,
    // "lives in a rural area", "resident of India" say nothing about who the patient is.
    keep: (m) => !/^(?:a|an|the|rural|urban|village|slum|joint|nuclear|hostel|care|nursing|old|same|his|her|their|india|alone)\b/i.test(m.replace(LIVES_PREFIX, '')),
    trim: (m) => m.replace(/[\s,.]+$/, ''),
  },
  { label: 'a date of birth', re: /\b(?:DOB|D\.O\.B\.?|date of birth|born on)\s*[:-]?\s*\d{1,2}[/.\s-]\s*(?:\d{1,2}|[A-Za-z]{3,9})[/.\s-]\s*\d{2,4}\b/gi },
  { label: 'an exact date', re: /\b\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)\d{2}\b/g },
  { label: 'an address', re: /\b(?:address\s*[:-]\s*\S.{2,40}|(?:house|h\.?|flat|plot|door)\s*no\.?\s*[:#-]?\s*\d+[A-Z]?|pin\s*code\s*[:-]?\s*\d{6})/gi },
];

// A request only counts in a sentence that asks for something.
const ASKING = /\?|\b(?:what|who|where|which|tell|share|send|give|reveal|dm|pm|inbox|let (?:me|us) know|can you|could you|please|pls|plz)\b/i;
const REQUESTS = [
  /\b(?:patient|pt|his|her|their|the lady|the man|the woman|the girl|the boy|the child|the baby)(?:'s|s'|’s)?\s+(?:full\s+|real\s+|exact\s+|home\s+)?(?:name|address|phone(?:\s*number)?|mobile(?:\s*number)?|contact(?:\s*(?:number|details|info))?|aadhaa?r|identity|house|village|hometown|MRN|UHID|bed(?:\s*(?:number|no))?)\b/gi,
  /\b(?:which|what|name of the|name of that|where(?:'s| is)? the)\s+(?:hospital|clinic|nursing home|medical college|bed|room)\b/gi,
  /\bwho is (?:the |this |that )?(?:patient|pt|lady|man|woman|guy|girl|boy|child|baby|kid)\b/gi,
  /\bwhere (?:is|was|does|did) (?:the |this |that )?(?:patient|pt|she|he|lady|man|child|baby)\b[^.?!\n]{0,25}?\b(?:admitted|staying|stay|live|lives|living|from|treated|come from)\b/gi,
  /\b(?:send|share|give|dm|pm|inbox)\b[^.?!\n]{0,25}?\b(?:patient|pt)(?:'s|s')?\s+(?:details|info|information|contact|number|photo|pictures?|reports?)\b/gi,
];

/** Every privacy problem in `text`: [{ start, end, text, label, kind }], in reading order. */
export function findPrivacyIssues(text) {
  if (!text || typeof text !== 'string') return [];
  const found = [];
  for (const { label, re, keep, trim } of IDENTIFIERS) {
    for (const m of text.matchAll(re)) {
      if (keep && !keep(m[0])) continue;
      const len = trim ? trim(m[0]).length : m[0].length;
      found.push({ start: m.index, end: m.index + len, label, kind: 'identifier' });
    }
  }
  // Sentences (split on . ! ? and new lines) that ask for something.
  for (const s of text.matchAll(/[^.!?\n]+[.!?]*/g)) {
    if (!ASKING.test(s[0])) continue;
    for (const re of REQUESTS) {
      for (const m of s[0].matchAll(re)) {
        const start = s.index + m.index;
        found.push({ start, end: start + m[0].length, label: "a request for the patient's identity", kind: 'request' });
      }
    }
  }
  // Longest first, drop overlaps; then join neighbours like "Bed 14" + ", " + "St. Mary's".
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged = [];
  for (const f of found) {
    const last = merged[merged.length - 1];
    if (last && f.start < last.end) {
      if (f.kind === 'request') last.kind = 'request';
      last.end = Math.max(last.end, f.end);
    } else if (last && last.kind === f.kind && /^[\s,]*(?:at|in|of|,)?[\s,]*$/i.test(text.slice(last.end, f.start))) {
      last.end = f.end;
    } else merged.push({ ...f });
  }
  return merged.map((f) => ({ ...f, text: text.slice(f.start, f.end) }));
}

/** The warning line for one problem, e.g. '"Bed 14, St. Mary's" could identify the patient.' */
export function privacyMessage(issue) {
  return issue.kind === 'request'
    ? `"${issue.text}" asks for the patient's identity. Asking who a patient is, where they are or how to contact them is not allowed on Tectum.`
    : `"${issue.text}" could identify the patient. Remove it before posting.`;
}

/** `text` with one problem cut out and the spacing/punctuation around it tidied. */
export function removePrivacyIssue(text, issue) {
  return (text.slice(0, issue.start) + text.slice(issue.end))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/([.,;:])(?:\s*[.,;:])+/g, '$1')
    .replace(/^[\s,;:]+/, '');
}
