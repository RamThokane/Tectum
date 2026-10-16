import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Check, Plus, Compass, Sparkles, Clock } from 'lucide-react';
import { PageShell } from '../components/Layout';
import Avatar from '../components/Avatar';
import { Skeleton } from '../components/ui';
import { useWards, useToggleWard } from '../hooks/useWards';
import { specialtyMeta, groupForCourse, wardsByGroup, WARD_GROUPS } from '../lib/specialties';
import { useAuthStore } from '../store/auth';
import { cn, timeAgo, pluralize } from '../lib/format';
import { SpecialtyDot } from '../components/ds/display';

/** One line about what each Ward covers (shown on its card). */
const ABOUT = {
  anatomy: 'Structures, landmarks, clinical anatomy and mnemonics.',
  physiology: 'How the body works, from cells to systems.',
  biochemistry: 'Metabolism, enzymes, genetics and lab values.',
  pathology: 'Disease mechanisms, histopathology and specimens.',
  pharmacology: 'Drugs, mechanisms, doses and side effects.',
  microbiology: 'Bugs, infections, stains and antimicrobials.',
  'internal-medicine': 'Ward rounds, diagnosis and day-to-day medicine.',
  cardiology: 'ECGs, heart failure, ACS and arrhythmias.',
  neurology: 'Strokes, seizures, localisation and neuro exams.',
  pulmonology: 'Chest X-rays, asthma, COPD and ventilation.',
  gastroenterology: 'GI bleeds, liver disease and endoscopy.',
  nephrology: 'AKI, CKD, electrolytes and dialysis.',
  endocrinology: 'Diabetes, thyroid, adrenal and hormones.',
  hematology: 'Anaemias, bleeding disorders and blood films.',
  oncology: 'Cancer diagnosis, staging and treatment.',
  'infectious-disease': 'Fever work-ups, sepsis and antibiotics.',
  'emergency-medicine': 'Resuscitation, triage and acute cases.',
  'critical-care': 'ICU, ventilators, shock and organ support.',
  surgery: 'Surgical cases, acute abdomen and operative care.',
  orthopedics: 'Fractures, joints, X-rays and trauma.',
  pediatrics: 'Child health, milestones and neonatal care.',
  obgyn: 'Pregnancy, labour and gynaecology.',
  psychiatry: 'Mental state exams, disorders and therapy.',
  dermatology: 'Rashes, lesions and skin photo quizzes.',
  radiology: 'Reading X-rays, CTs, MRIs and ultrasound.',
  anesthesiology: 'Airway, anaesthesia, pain and peri-op care.',
  ophthalmology: 'Eye exams, fundus images and red eye.',
  ent: 'Ear, nose and throat cases and exams.',
  'family-medicine': 'Primary care and long-term conditions.',
  'public-health': 'Epidemiology, biostatistics and PSM.',
  nursing: 'Nursing care, procedures and patient safety.',
  research: 'Study design, papers, audits and stats.',
  // Dental
  'dental-anatomy': 'Tooth morphology, eruption, histology and embryology.',
  'dental-materials': 'Impression, restorative and prosthetic materials.',
  'oral-pathology': 'Oral lesions, cysts, tumours and histopathology.',
  'oral-medicine': 'Oral diagnosis, mucosal disease and dental radiology (OPG, IOPA).',
  'conservative-dentistry': 'Caries, restorations and root canal treatment.',
  prosthodontics: 'Dentures, crowns, bridges and implants.',
  periodontics: 'Gum disease, scaling, flap surgery and implants.',
  orthodontics: 'Malocclusion, cephalometrics and braces.',
  'oral-surgery': 'Extractions, facial trauma and maxillofacial surgery.',
  pedodontics: 'Children’s dental care and behaviour management.',
  'public-health-dentistry': 'Oral epidemiology, prevention and community programmes.',
  // Ayurveda
  'samhita-siddhanta': 'Classical texts (Charaka, Sushruta) and core principles.',
  'rachana-sharir': 'Ayurvedic anatomy, marma and dissection.',
  'kriya-sharir': 'Dosha, dhatu, agni and physiology.',
  dravyaguna: 'Medicinal plants, rasa, virya and their actions.',
  'rasa-shastra': 'Herbo-mineral preparations and formulations.',
  'roga-nidana': 'Diagnosis, nidana panchaka and pathology.',
  kayachikitsa: 'Ayurvedic internal medicine and case management.',
  panchakarma: 'Vamana, virechana, basti, nasya and procedures.',
  'shalya-tantra': 'Ayurvedic surgery, kshara sutra and wounds.',
  'shalakya-tantra': 'Eye, ENT, head and dental disorders in Ayurveda.',
  'prasuti-tantra': 'Pregnancy, labour and women’s health in Ayurveda.',
  kaumarabhritya: 'Child health and paediatrics in Ayurveda.',
  swasthavritta: 'Preventive medicine, diet, daily routine and yoga.',
  'agada-tantra': 'Toxicology, poisons and forensic medicine.',
  // Nursing
  'fundamentals-of-nursing': 'Nursing procedures, vitals, asepsis and care plans.',
  'medical-surgical-nursing': 'Adult medical and surgical patient care.',
  'child-health-nursing': 'Newborn and paediatric nursing care.',
  'mental-health-nursing': 'Psychiatric nursing and therapeutic communication.',
  'community-health-nursing': 'Family health, immunisation and community care.',
  'obstetric-nursing': 'Antenatal, labour, postnatal and newborn care.',
  'critical-care-nursing': 'ICU nursing, monitoring and emergencies.',
  // Physiotherapy
  'exercise-therapy': 'Therapeutic exercise, ROM and strengthening.',
  electrotherapy: 'TENS, IFT, ultrasound and other modalities.',
  'musculoskeletal-physio': 'Back pain, joints, fractures and rehab.',
  'neuro-physio': 'Stroke, spinal cord injury and neuro rehab.',
  'cardiopulmonary-physio': 'Chest physio, breathing exercises and cardiac rehab.',
  'sports-physio': 'Sports injuries, taping and return to play.',
  'occupational-therapy': 'Daily living skills, hand therapy and splints.',
  // Pharmacy
  pharmaceutics: 'Dosage forms, formulation and drug delivery.',
  'pharmaceutical-chemistry': 'Medicinal chemistry, synthesis and analysis.',
  pharmacognosy: 'Natural drugs, phytochemistry and herbal medicines.',
  'clinical-pharmacy': 'Prescriptions, interactions and patient counselling.',
  // Allied health
  'medical-lab-technology': 'Lab tests, haematology, biochemistry and QC.',
  'radiography-imaging': 'X-ray, CT and MRI technique and safety.',
  optometry: 'Refraction, lenses and eye examinations.',
  'audiology-speech': 'Hearing tests, hearing aids and speech therapy.',
  'nutrition-dietetics': 'Clinical nutrition, diet plans and counselling.',
  'operation-theatre-tech': 'OT setup, sterilisation and instruments.',
  'emergency-medical-services': 'Pre-hospital care, BLS/ACLS and triage.',
};

/**
 * Join / Joined button for a Ward. Quiet outline in lists (a grid of solid buttons is loud);
 * `primary` makes Join the solid blue action (a Ward's own page). Joined is soft blue with a tick.
 */
export function JoinWardButton({ ward, className, primary = false }) {
  const toggle = useToggleWard();
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate(ward.slug);
      }}
      disabled={toggle.isPending}
      className={cn(
        ward.joined ? 'btn border border-transparent bg-ds-brand-soft text-ds-brand-text' : primary ? 'btn-primary' : 'btn-secondary',
        'min-h-9 shrink-0 px-3.5 text-[13px]',
        className
      )}
      aria-pressed={ward.joined}
      aria-label={ward.joined ? `Leave ${specialtyMeta(ward.slug).label}` : `Join ${specialtyMeta(ward.slug).label}`}
    >
      {ward.joined ? <><Check className="h-4 w-4" strokeWidth={1.75} /> Joined</> : <><Plus className="h-4 w-4" strokeWidth={1.75} /> Join</>}
    </button>
  );
}

/** Stats line with no bare zeros: "12 members · 40 posts", or an encouraging note instead. */
function WardStats({ ward }) {
  const parts = [];
  if (ward.members) parts.push(`${pluralize(ward.members, 'member')}`);
  if (ward.posts) parts.push(`${pluralize(ward.posts, 'post')}`);
  if (!parts.length) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-link">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} /> New Ward · be the first to post
      </span>
    );
  }
  if (!ward.posts) parts.push('be the first to post');
  return <span>{parts.join(' · ')}</span>;
}

function WardCard({ ward }) {
  const m = specialtyMeta(ward.slug);
  const faces = ward.sampleMembers ?? [];
  return (
    <Link to={`/ward/${ward.slug}`} className="card card-hover relative flex flex-col gap-3 overflow-hidden p-4">
      <div className="flex items-start gap-3">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-line text-ds-fg-2">
          <m.icon className="h-5 w-5" strokeWidth={1.5} />
          {ward.newCount > 0 && (
            <span className="ds-num absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-ds-accent px-1 text-center text-[12px] font-semibold leading-5 text-ds-on-accent ring-2 ring-ds-surface" aria-label={`${ward.newCount} new posts`}>
              {ward.newCount > 99 ? '99+' : ward.newCount}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-editorial text-[20px] font-medium leading-[26px] tracking-[-0.01em]">
            <SpecialtyDot hue={m.hue} /> <span className="truncate">{m.label}</span>
          </h3>
          <p className="muted mt-0.5 line-clamp-2 text-[13px] leading-[18px]">{ABOUT[ward.slug] ?? m.label}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-3 border-t border-line pt-3">
        {faces.length > 0 && (
          <span className="flex -space-x-2" aria-hidden="true">
            {faces.map((u) => (
              <Avatar key={u._id} user={u} size="xs" className="ring-2 ring-ds-surface" />
            ))}
          </span>
        )}
        <div className="muted ds-num min-w-0 flex-1 text-[12px] leading-4">
          <WardStats ward={ward} />
          {ward.lastActiveAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" strokeWidth={1.5} /> Active {timeAgo(ward.lastActiveAt)}
            </span>
          )}
        </div>
        <JoinWardButton ward={ward} />
      </div>
    </Link>
  );
}

function WardGrid({ children }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function WardsSkeleton() {
  return (
    <WardGrid>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="card p-4" aria-hidden="true">
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-[12px]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-9 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </WardGrid>
  );
}

/** All Wards (subject channels), filtered by course (opens on your own), your joined ones first. */
export default function Wards() {
  const { data, isPending } = useWards();
  const me = useAuthStore((s) => s.user);
  const [q, setQ] = useState('');
  // Course filter, kept in the address; starts on the member's own course group (or All).
  const [params, setParams] = useSearchParams();
  const group = params.get('course') ?? groupForCourse(me?.course) ?? 'all';
  const setGroup = (id) => setParams(id === 'all' ? { course: 'all' } : { course: id }, { replace: true });
  const inGroup = (w) => group === 'all' || specialtyMeta(w.slug).group === group;
  const search = q.trim().toLowerCase();
  // Searching looks through every course.
  const match = (w) => (search ? specialtyMeta(w.slug).label.toLowerCase().includes(search) : inGroup(w));
  const list = (data ?? []).filter(match);
  const mine = list.filter((w) => w.joined);
  const others = list.filter((w) => !w.joined).sort((a, b) => b.posts + b.members - (a.posts + a.members));
  const current = WARD_GROUPS.find((g) => g.id === group);
  // "All" (and search) shows the other Wards under a heading per course, your course first.
  const sections =
    group === 'all' || search
      ? wardsByGroup(me?.course)
          .map((g) => ({ ...g, items: others.filter((w) => specialtyMeta(w.slug).group === g.id) }))
          .filter((g) => g.items.length)
      : [{ id: group, label: current ? `${current.label} Wards` : 'Wards', hint: current?.hint, items: others }];

  // keep the chosen course button in view on phones
  const rowRef = useRef(null);
  useEffect(() => {
    const row = rowRef.current;
    const el = row?.querySelector('[aria-selected="true"]');
    if (row && el) row.scrollLeft = el.offsetLeft - (row.clientWidth - el.clientWidth) / 2;
  }, [group]);

  return (
    <PageShell
      cards
      wide
      title="Wards"
      subtitle="Subject channels for every course. Join the ones you study."
      actions={
        <Link to="/discover" className="btn-secondary shrink-0 px-3 text-[13px]" aria-label="Explore topics">
          <Compass className="h-4 w-4" strokeWidth={1.5} /> <span className="hidden sm:inline">Explore topics</span>
        </Link>
      }
    >
      <div className="space-y-3 pt-1">
        <div ref={rowRef} role="tablist" aria-label="Course" className="segmented">
          {[{ id: 'all', label: 'All courses' }, ...WARD_GROUPS].map((g) => (
            <button key={g.id} role="tab" aria-selected={group === g.id} onClick={() => setGroup(g.id)} title={g.hint} className={cn('segment', group === g.id && 'segment-active')}>
              {g.label}
            </button>
          ))}
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ds-fg-3" strokeWidth={1.5} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a Ward in any course, e.g. Orthodontics"
            className="input py-3 pl-10"
            aria-label="Find a Ward"
          />
        </label>
      </div>

      {isPending ? (
        <WardsSkeleton />
      ) : (
        <>
          {mine.length > 0 && (
            <section aria-labelledby="my-wards">
              <h2 id="my-wards" className="ds-eyebrow ds-num mb-2 mt-3 px-1">Your Wards · {mine.length}</h2>
              <WardGrid>{mine.map((w) => <WardCard key={w.slug} ward={w} />)}</WardGrid>
            </section>
          )}
          {sections.map((s) => (
            <section key={s.id} aria-labelledby={`wards-${s.id}`}>
              <h2 id={`wards-${s.id}`} className="ds-eyebrow mb-2 mt-3 px-1">
                {s.label}
                {s.hint && <span className="ml-1.5 font-normal normal-case tracking-normal">· {s.hint}</span>}
              </h2>
              <WardGrid>{s.items.map((w) => <WardCard key={w.slug} ward={w} />)}</WardGrid>
            </section>
          ))}
          {!sections.length && (
            <p className="muted px-1 text-[15px]">{search ? `No Ward matches "${q}".` : "You've joined every Ward here!"}</p>
          )}
        </>
      )}
    </PageShell>
  );
}