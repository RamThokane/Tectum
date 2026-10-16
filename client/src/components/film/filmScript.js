/**
 * The landing-page film: one teaching case (the same example the landing page falls back to),
 * told in about a minute. Everything on screen is drawn from these timings, in seconds.
 *
 * Narration: one recording of the whole script, client/public/film/narration.mp3, played from
 * NARRATION.offset seconds into the film and kept in step with the film's clock. The cue times
 * below are where each line is spoken in that recording (measured from its pauses) plus the
 * offset, so captions match the voice. Without the file the film still plays, with captions.
 * Background music (optional): client/public/film/music.mp3 (kept very quiet under the voice).
 */

export const FILM_DURATION = 62;

export const NARRATION = { src: '/film/narration.mp3', offset: 0.55 };

/** Narration, which is also the captions and the transcript. */
export const CUES = [
  { id: '01', start: 0.59, end: 3.15, text: "Medicine isn't learned from answers alone." },
  { id: '02', start: 4.01, end: 10.09, text: 'Tectum is case-based learning for medical students and doctors, built on real, de-identified cases.' },
  { id: '03', start: 10.79, end: 15.73, text: "Here's one. A man in his fifties. Chest pain for two hours, spreading to his jaw." },
  { id: '04', start: 16.39, end: 22.47, text: 'Read it as you would on rounds. Slow pulse, low pressure, raised JVP, and clear lungs.' },
  { id: '05', start: 23.13, end: 27.73, text: 'The ECG: ST elevation in leads two, three and aVF.' },
  { id: '06', start: 28.43, end: 33.83, text: 'Before anything is revealed, you commit to a diagnosis. Thinking first is the point.' },
  { id: '07', start: 34.47, end: 42.01, text: 'Then the reasoning. An inferior STEMI, with low pressure, a raised JVP and clear lungs, points to the right ventricle.' },
  { id: '08', start: 42.55, end: 47.25, text: 'So nitrates are avoided, and fluids are given carefully while reperfusion is arranged.' },
  { id: '09', start: 47.85, end: 51.49, text: "Saved cases return as flashcards, right before you'd forget them." },
  { id: '10', start: 52.05, end: 56.77, text: 'Discuss cases with peers and verified doctors, in Wards for every subject.' },
  { id: '11', start: 57.55, end: 61.51, text: 'Tectum. Learn medicine, one real case at a time.' },
];

/** When things happen on screen. */
export const T = {
  hookSwap: 3.7, // "answers alone" makes way for "Learn from real cases."
  open: 5.6, // the line opens into the case
  eyebrow: 6.6,
  title: 10.6,
  complaint: 12.0,
  exam: 16.8,
  marks: [18.6, 19.5, 20.4, 21.3], // pulse, pressure, JVP, lungs
  labs: 23.6,
  leads: 25.4,
  poll: 28.4,
  pick: 31.0,
  reveal: 32.4,
  reason: 34.2,
  clues: [35.4, 36.8, 38.0],
  joins: 38.8,
  points: 39.8,
  diagnosis: 41.6,
  why: 42.8,
  saved: 46.9,
  flip: 48.8,
  grade: 49.9,
  good: 50.8,
  value: 51.8,
  close: 56.8, // the frame closes to the final message
  final: 57.8,
  cta: 59.6,
};

/** Soft interface sounds (only with sound on): [time, kind]. */
export const SFX = [
  [T.open, 'whoosh'],
  [T.pick, 'tap'],
  [T.reveal, 'chime'],
  [T.saved, 'tap'],
  [T.flip, 'whoosh'],
  [T.good, 'tap'],
  [T.close, 'whoosh'],
];

/** The case (same teaching example as the landing page's sample case). */
export const CASE = {
  specialty: 'Cardiology',
  ageSex: '50s · Male',
  title: 'Crushing chest pain in a 50s smoker',
  complaint: 'Central chest pain for 2 hours, radiating to the jaw, with sweating.',
  options: ['Inferior STEMI with right ventricular involvement', 'Aortic dissection', 'Pulmonary embolism', 'Pericarditis'],
  correct: 0,
  diagnosis: 'Inferior STEMI with right ventricular infarction',
  why: 'Hypotension with a raised JVP and clear lungs in an inferior STEMI suggests RV infarction: avoid nitrates and give fluids cautiously while arranging reperfusion.',
};
