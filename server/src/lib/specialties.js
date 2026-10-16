import {
  Accessibility,
  Activity,
  Baby,
  Bone,
  BookOpen,
  Brain,
  Bug,
  Droplet,
  Droplets,
  Ear,
  Eye,
  FlaskConical,
  Gauge,
  Heart,
  HeartPulse,
  Hospital,
  Microscope,
  Pill,
  Ribbon,
  Scan,
  Scissors,
  ShieldPlus,
  Siren,
  Smile,
  Stethoscope,
  Syringe,
  Users,
  Utensils,
  Venus,
  Wind,
  Hand,
  Dna,
  FlaskRound,
  ScanLine,
  Shield,
  Crown,
  Anchor,
  ScrollText,
  Leaf,
  Waves,
  Sun,
  Flower2,
  Beaker,
  Sprout,
  Mountain,
  HeartHandshake,
  House,
  Dumbbell,
  Zap,
  Footprints,
  PillBottle,
  Atom,
  BriefcaseMedical,
  TestTube,
  Radiation,
  Glasses,
  AudioLines,
  Salad,
  Ambulance,
} from 'lucide-react';

/**
 * Each specialty keeps one colour, but only ever as a small dot (the redesign's 8 specialty hues,
 * --ds-spec-1..8). Tiles and pills are quiet neutrals. Full class names written out for Tailwind.
 *  - soft: icon tile (neutral fill)
 *  - pill: outlined tag pill (neutral)
 *  - solid: the dot / thin bar in the specialty colour
 */
const SOFT = 'bg-surface-2 text-ds-fg-2';
const PILL = 'border-line-strong text-ds-fg-2';
const HUES = {
  teal: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-1' },
  cyan: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-1' },
  emerald: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-7' },
  lime: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-7' },
  sky: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-2' },
  blue: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-2' },
  indigo: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-3' },
  violet: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-3' },
  purple: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-4' },
  fuchsia: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-4' },
  pink: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-4' },
  rose: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-5' },
  red: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-5' },
  orange: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-6' },
  amber: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-6' },
  slate: { soft: SOFT, pill: PILL, solid: 'bg-ds-spec-8' },
};

/**
 * MBBS years, for filtering the Wards page (Indian curriculum: pre-clinical, para-clinical,
 * 3rd year part 1, final year clinical subjects, then specialties beyond MBBS).
 */
export const WARD_YEARS = [
  { id: '1', label: '1st Year', hint: 'Pre-clinical' },
  { id: '2', label: '2nd Year', hint: 'Para-clinical' },
  { id: '3', label: '3rd Year', hint: 'Part 1' },
  { id: 'final', label: 'Final Year', hint: 'Clinical' },
  { id: 'specialty', label: 'Specialties', hint: 'Beyond MBBS' },
];

/** Wards: one per specialty (slug = the post tag). Keep in sync with server/src/data/wards.js. */
export const WARDS = [
  { slug: 'anatomy', label: 'Anatomy', icon: Bone, hue: 'orange', year: '1' },
  { slug: 'physiology', label: 'Physiology', icon: HeartPulse, hue: 'pink', year: '1' },
  { slug: 'biochemistry', label: 'Biochemistry', icon: FlaskConical, hue: 'lime', year: '1' },
  { slug: 'pathology', label: 'Pathology', icon: Microscope, hue: 'purple', year: '2' },
  { slug: 'pharmacology', label: 'Pharmacology', icon: Pill, hue: 'emerald', year: '2' },
  { slug: 'microbiology', label: 'Microbiology', icon: Bug, hue: 'lime', year: '2' },
  { slug: 'internal-medicine', label: 'Internal Medicine', icon: Stethoscope, hue: 'teal', year: 'final' },
  { slug: 'cardiology', label: 'Cardiology', icon: Heart, hue: 'rose', year: 'specialty' },
  { slug: 'neurology', label: 'Neurology', icon: Brain, hue: 'violet', year: 'specialty' },
  { slug: 'pulmonology', label: 'Pulmonology', icon: Wind, hue: 'sky', year: 'specialty' },
  { slug: 'gastroenterology', label: 'Gastroenterology', icon: Utensils, hue: 'amber', year: 'specialty' },
  { slug: 'nephrology', label: 'Nephrology', icon: Droplets, hue: 'cyan', year: 'specialty' },
  { slug: 'endocrinology', label: 'Endocrinology', icon: Gauge, hue: 'fuchsia', year: 'specialty' },
  { slug: 'hematology', label: 'Hematology', icon: Droplet, hue: 'red', year: 'specialty' },
  { slug: 'oncology', label: 'Oncology', icon: Ribbon, hue: 'purple', year: 'specialty' },
  { slug: 'infectious-disease', label: 'Infectious Disease', icon: ShieldPlus, hue: 'lime', year: 'specialty' },
  { slug: 'emergency-medicine', label: 'Emergency Medicine', icon: Siren, hue: 'red', year: 'specialty' },
  { slug: 'critical-care', label: 'Critical Care', icon: Activity, hue: 'orange', year: 'specialty' },
  { slug: 'surgery', label: 'Surgery', icon: Scissors, hue: 'blue', year: 'final' },
  { slug: 'orthopedics', label: 'Orthopedics', icon: Accessibility, hue: 'amber', year: 'final' },
  { slug: 'pediatrics', label: 'Pediatrics', icon: Baby, hue: 'sky', year: 'final' },
  { slug: 'obgyn', label: 'Obstetrics & Gynaecology', short: 'OBGYN', icon: Venus, hue: 'pink', year: 'final' },
  { slug: 'psychiatry', label: 'Psychiatry', icon: Smile, hue: 'indigo', year: 'final' },
  { slug: 'dermatology', label: 'Dermatology', icon: Hand, hue: 'amber', year: 'final' },
  { slug: 'radiology', label: 'Radiology', icon: Scan, hue: 'slate', year: 'final' },
  { slug: 'anesthesiology', label: 'Anaesthesiology', icon: Syringe, hue: 'teal', year: 'final' },
  { slug: 'ophthalmology', label: 'Ophthalmology', icon: Eye, hue: 'cyan', year: '3' },
  { slug: 'ent', label: 'ENT', icon: Ear, hue: 'indigo', year: '3' },
  { slug: 'family-medicine', label: 'Family Medicine', icon: Users, hue: 'emerald', year: 'specialty' },
  { slug: 'public-health', label: 'Public Health', icon: Hospital, hue: 'blue', year: '3' },
  { slug: 'nursing', label: 'Nursing', icon: Stethoscope, hue: 'pink', year: 'specialty' },
  { slug: 'research', label: 'Research', icon: Dna, hue: 'violet', year: 'specialty', group: 'general' },

  // ---- Dental (BDS / MDS)
  { slug: 'dental-anatomy', label: 'Dental Anatomy & Histology', short: 'Dental Anatomy', icon: Smile, hue: 'sky', group: 'dental' },
  { slug: 'dental-materials', label: 'Dental Materials', icon: FlaskRound, hue: 'slate', group: 'dental' },
  { slug: 'oral-pathology', label: 'Oral Pathology & Microbiology', short: 'Oral Pathology', icon: Microscope, hue: 'purple', group: 'dental' },
  { slug: 'oral-medicine', label: 'Oral Medicine & Radiology', short: 'Oral Medicine', icon: ScanLine, hue: 'indigo', group: 'dental' },
  { slug: 'conservative-dentistry', label: 'Conservative Dentistry & Endodontics', short: 'Endodontics', icon: Shield, hue: 'teal', group: 'dental' },
  { slug: 'prosthodontics', label: 'Prosthodontics', icon: Crown, hue: 'amber', group: 'dental' },
  { slug: 'periodontics', label: 'Periodontics', icon: Droplet, hue: 'rose', group: 'dental' },
  { slug: 'orthodontics', label: 'Orthodontics', icon: Anchor, hue: 'blue', group: 'dental' },
  { slug: 'oral-surgery', label: 'Oral & Maxillofacial Surgery', short: 'Oral Surgery', icon: Scissors, hue: 'red', group: 'dental' },
  { slug: 'pedodontics', label: 'Pediatric Dentistry', icon: Baby, hue: 'pink', group: 'dental' },
  { slug: 'public-health-dentistry', label: 'Public Health Dentistry', icon: Users, hue: 'emerald', group: 'dental' },

  // ---- Ayurveda (BAMS)
  { slug: 'samhita-siddhanta', label: 'Samhita & Siddhanta', icon: ScrollText, hue: 'amber', group: 'ayurveda' },
  { slug: 'rachana-sharir', label: 'Rachana Sharir (Anatomy)', short: 'Rachana Sharir', icon: Bone, hue: 'orange', group: 'ayurveda' },
  { slug: 'kriya-sharir', label: 'Kriya Sharir (Physiology)', short: 'Kriya Sharir', icon: HeartPulse, hue: 'pink', group: 'ayurveda' },
  { slug: 'dravyaguna', label: 'Dravyaguna (Herbal Pharmacology)', short: 'Dravyaguna', icon: Leaf, hue: 'lime', group: 'ayurveda' },
  { slug: 'rasa-shastra', label: 'Rasa Shastra & Bhaishajya Kalpana', short: 'Rasa Shastra', icon: FlaskConical, hue: 'fuchsia', group: 'ayurveda' },
  { slug: 'roga-nidana', label: 'Roga Nidana (Diagnosis)', short: 'Roga Nidana', icon: Microscope, hue: 'purple', group: 'ayurveda' },
  { slug: 'kayachikitsa', label: 'Kayachikitsa (Medicine)', short: 'Kayachikitsa', icon: Stethoscope, hue: 'teal', group: 'ayurveda' },
  { slug: 'panchakarma', label: 'Panchakarma', icon: Waves, hue: 'cyan', group: 'ayurveda' },
  { slug: 'shalya-tantra', label: 'Shalya Tantra (Surgery)', short: 'Shalya Tantra', icon: Scissors, hue: 'blue', group: 'ayurveda' },
  { slug: 'shalakya-tantra', label: 'Shalakya Tantra (Eye & ENT)', short: 'Shalakya Tantra', icon: Eye, hue: 'indigo', group: 'ayurveda' },
  { slug: 'prasuti-tantra', label: 'Prasuti Tantra & Stri Roga', short: 'Prasuti Tantra', icon: Venus, hue: 'rose', group: 'ayurveda' },
  { slug: 'kaumarabhritya', label: 'Kaumarabhritya (Paediatrics)', short: 'Kaumarabhritya', icon: Baby, hue: 'sky', group: 'ayurveda' },
  { slug: 'swasthavritta', label: 'Swasthavritta & Yoga', short: 'Swasthavritta', icon: Sun, hue: 'emerald', group: 'ayurveda' },
  { slug: 'agada-tantra', label: 'Agada Tantra (Toxicology)', short: 'Agada Tantra', icon: ShieldPlus, hue: 'red', group: 'ayurveda' },

  // ---- Nursing
  { slug: 'fundamentals-of-nursing', label: 'Fundamentals of Nursing', icon: HeartHandshake, hue: 'pink', group: 'nursing' },
  { slug: 'medical-surgical-nursing', label: 'Medical-Surgical Nursing', icon: Stethoscope, hue: 'teal', group: 'nursing' },
  { slug: 'child-health-nursing', label: 'Child Health Nursing', icon: Baby, hue: 'sky', group: 'nursing' },
  { slug: 'mental-health-nursing', label: 'Mental Health Nursing', icon: Brain, hue: 'indigo', group: 'nursing' },
  { slug: 'community-health-nursing', label: 'Community Health Nursing', icon: House, hue: 'emerald', group: 'nursing' },
  { slug: 'obstetric-nursing', label: 'Midwifery & Obstetric Nursing', short: 'Midwifery', icon: Venus, hue: 'rose', group: 'nursing' },
  { slug: 'critical-care-nursing', label: 'Critical Care Nursing', icon: Activity, hue: 'orange', group: 'nursing' },

  // ---- Physiotherapy & occupational therapy
  { slug: 'exercise-therapy', label: 'Exercise Therapy', icon: Dumbbell, hue: 'orange', group: 'physio' },
  { slug: 'electrotherapy', label: 'Electrotherapy', icon: Zap, hue: 'amber', group: 'physio' },
  { slug: 'musculoskeletal-physio', label: 'Musculoskeletal Physiotherapy', short: 'MSK Physio', icon: Bone, hue: 'blue', group: 'physio' },
  { slug: 'neuro-physio', label: 'Neurological Physiotherapy', short: 'Neuro Physio', icon: Brain, hue: 'violet', group: 'physio' },
  { slug: 'cardiopulmonary-physio', label: 'Cardiopulmonary Physiotherapy', short: 'Cardio-Pulm Physio', icon: Wind, hue: 'sky', group: 'physio' },
  { slug: 'sports-physio', label: 'Sports Physiotherapy', short: 'Sports Physio', icon: Footprints, hue: 'emerald', group: 'physio' },
  { slug: 'occupational-therapy', label: 'Occupational Therapy', icon: Hand, hue: 'teal', group: 'physio' },

  // ---- Pharmacy
  { slug: 'pharmaceutics', label: 'Pharmaceutics', icon: PillBottle, hue: 'emerald', group: 'pharmacy' },
  { slug: 'pharmaceutical-chemistry', label: 'Pharmaceutical Chemistry', short: 'Pharma Chemistry', icon: Atom, hue: 'violet', group: 'pharmacy' },
  { slug: 'pharmacognosy', label: 'Pharmacognosy', icon: Leaf, hue: 'lime', group: 'pharmacy' },
  { slug: 'clinical-pharmacy', label: 'Clinical Pharmacy', icon: BriefcaseMedical, hue: 'teal', group: 'pharmacy' },

  // ---- Allied health
  { slug: 'medical-lab-technology', label: 'Medical Lab Technology', short: 'Lab Technology', icon: TestTube, hue: 'purple', group: 'allied' },
  { slug: 'radiography-imaging', label: 'Radiography & Imaging', icon: Radiation, hue: 'slate', group: 'allied' },
  { slug: 'optometry', label: 'Optometry', icon: Glasses, hue: 'cyan', group: 'allied' },
  { slug: 'audiology-speech', label: 'Audiology & Speech Therapy', short: 'Audiology', icon: AudioLines, hue: 'indigo', group: 'allied' },
  { slug: 'nutrition-dietetics', label: 'Nutrition & Dietetics', short: 'Nutrition', icon: Salad, hue: 'lime', group: 'allied' },
  { slug: 'operation-theatre-tech', label: 'Operation Theatre Technology', short: 'OT Technology', icon: Hospital, hue: 'blue', group: 'allied' },
  { slug: 'emergency-medical-services', label: 'Paramedic & Emergency Care', short: 'Paramedic', icon: Ambulance, hue: 'red', group: 'allied' },
].map((w) => ({ group: w.slug === 'nursing' ? 'nursing' : 'medicine', ...w }));

/** Course groups the Wards are arranged in (Wards page filter, feed chips). */
export const WARD_GROUPS = [
  { id: 'medicine', label: 'Medicine', hint: 'MBBS & specialties' },
  { id: 'dental', label: 'Dental', hint: 'BDS / MDS' },
  { id: 'ayurveda', label: 'Ayurveda', hint: 'BAMS' },
  { id: 'nursing', label: 'Nursing', hint: 'B.Sc / GNM / ANM' },
  { id: 'physio', label: 'Physiotherapy', hint: 'BPT / BOT' },
  { id: 'pharmacy', label: 'Pharmacy', hint: 'B.Pharm / Pharm.D' },
  { id: 'allied', label: 'Allied Health', hint: 'Lab, imaging, optometry…' },
  { id: 'general', label: 'Research', hint: 'For everyone' },
];

/** Which Ward group fits a member's course (see lib/courses.js); null = show everything. */
const COURSE_TO_GROUP = {
  mbbs: 'medicine', md: 'medicine', ms: 'medicine', dnb: 'medicine', 'dm-mch': 'medicine', 'intl-md': 'medicine', 'pg-diploma': 'medicine', bph: 'medicine',
  bds: 'dental', mds: 'dental',
  bams: 'ayurveda', 'md-ayush': 'ayurveda',
  'bsc-nursing': 'nursing', 'post-basic-nursing': 'nursing', gnm: 'nursing', anm: 'nursing', 'msc-nursing': 'nursing',
  bpt: 'physio', mpt: 'physio', bot: 'physio',
  bpharm: 'pharmacy', dpharm: 'pharmacy', pharmd: 'pharmacy', mpharm: 'pharmacy',
  bmlt: 'allied', 'bsc-allied': 'allied', baslp: 'allied', boptom: 'allied', 'bsc-nutrition': 'allied',
};
export const groupForCourse = (course) => COURSE_TO_GROUP[course] ?? null;

/** All Ward slugs, the member's own course group first (then Medicine, then the rest). */
export function slugsForCourse(course) {
  const g = groupForCourse(course);
  const rank = (w) => (w.group === g ? 0 : w.group === 'medicine' ? 1 : 2);
  return [...WARDS].sort((a, b) => rank(a) - rank(b)).map((w) => w.slug);
}

/** WARDS arranged by course group, the member's group first: [{ id, label, hint, wards }] */
export function wardsByGroup(course) {
  const g = groupForCourse(course);
  const groups = WARD_GROUPS.map((grp) => ({ ...grp, wards: WARDS.filter((w) => w.group === grp.id) }));
  return g ? [...groups.filter((x) => x.id === g), ...groups.filter((x) => x.id !== g)] : groups;
}

const BY_SLUG = new Map(WARDS.map((w) => [w.slug, w]));

/** Colours + icon for any tag. Unknown tags (e.g. "ecg") get a neutral look and a book icon. */
export function specialtyMeta(tag) {
  const w = BY_SLUG.get(tag);
  const hue = HUES[w?.hue ?? 'slate'];
  return {
    slug: tag,
    label: w?.label ?? (tag ? tag.replace(/-/g, ' ') : ''),
    short: w?.short ?? w?.label ?? (tag ? tag.replace(/-/g, ' ') : ''),
    icon: w?.icon ?? BookOpen,
    isWard: Boolean(w),
    year: w?.year ?? null,
    group: w?.group ?? null,
    hue: w?.hue ?? 'slate', // the hue's name, for the design system's SpecialtyDot
    ...hue,
  };
}

export const isWard = (tag) => BY_SLUG.has(tag);
/** A post's Ward: its first tag that is a specialty. */
export const wardOf = (post) => post?.tags?.find(isWard) ?? null;
