import {
  Stethoscope,
  Brain,
  HeartPulse,
  Heart,
  Syringe,
  Pill,
  Microscope,
  Dna,
  Bone,
  Thermometer,
  TestTube,
  NotebookPen,
  ClipboardPlus,
  Bandage,
  Tablets,
  Eye,
  FlaskConical,
} from 'lucide-react';

// Hand-drawn in lucide's style (24px grid, 2px round strokes) for things lucide doesn't have.
const svgProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

function LabCoat(props) {
  return (
    <svg {...svgProps} {...props}>
      <path d="M9 2.5 5 5 3 12l2.5 1V21h13v-8L21 12l-2-7-4-2.5" />
      <path d="M9 2.5 12 8l3-5.5" />
      <path d="M12 8v13" />
      <path d="M15 14h2" />
      <path d="M7 11h2" />
    </svg>
  );
}

function Scalpel(props) {
  return (
    <svg {...svgProps} {...props}>
      <path d="m3 21 9.5-9.5" />
      <path d="M12.5 11.5 18 6c1.5-1.5 3.5-1.5 3.5.5 0 2.5-4 5.5-7.5 6.5z" />
    </svg>
  );
}

function Forceps(props) {
  return (
    <svg {...svgProps} {...props}>
      <path d="M4 20 13 7l2-4" />
      <path d="M20 20 11 7 9 3" />
      <circle cx="5" cy="20" r="1.5" />
      <circle cx="19" cy="20" r="1.5" />
    </svg>
  );
}

const BLUE = 'text-link/30';
const BRAND = 'text-ds-brand-text/30';
const ROSE = 'text-danger/30';
const VIOLET = 'text-ds-brand-text/25';

/**
 * x/y: position (% of the hero), s: size (px), d: seconds per float cycle, delay: seconds,
 * beat: heart-style pulse, wide: only shown on tablet/desktop (keeps phones uncluttered).
 */
const ITEMS = [
  { Icon: Stethoscope, x: 6, y: 14, s: 64, d: 11, delay: 0, tone: BLUE },
  { Icon: Brain, x: 84, y: 10, s: 70, d: 13, delay: -3, tone: VIOLET },
  { Icon: HeartPulse, x: 88, y: 58, s: 60, d: 9, delay: -1, tone: ROSE, beat: true },
  { Icon: LabCoat, x: 5, y: 62, s: 66, d: 12, delay: -6, tone: BRAND },
  { Icon: NotebookPen, x: 18, y: 36, s: 44, d: 10, delay: -2, tone: BLUE, wide: true },
  { Icon: Scalpel, x: 76, y: 32, s: 46, d: 14, delay: -8, tone: BRAND, wide: true },
  { Icon: Forceps, x: 22, y: 82, s: 46, d: 12, delay: -4, tone: BLUE, wide: true },
  { Icon: Syringe, x: 70, y: 84, s: 48, d: 10, delay: -5, tone: BRAND },
  { Icon: Heart, x: 34, y: 6, s: 34, d: 8, delay: -2, tone: ROSE, beat: true, wide: true },
  { Icon: Microscope, x: 93, y: 34, s: 50, d: 15, delay: -7, tone: BLUE, wide: true },
  { Icon: Dna, x: 60, y: 4, s: 42, d: 12, delay: -9, tone: VIOLET, wide: true },
  { Icon: Pill, x: 45, y: 90, s: 34, d: 9, delay: -3, tone: ROSE, wide: true },
  { Icon: ClipboardPlus, x: 90, y: 86, s: 44, d: 11, delay: -1, tone: BLUE, wide: true },
  { Icon: Bone, x: 2, y: 40, s: 40, d: 13, delay: -10, tone: VIOLET, wide: true },
  { Icon: Thermometer, x: 80, y: 72, s: 38, d: 10, delay: -6, tone: ROSE, wide: true },
  { Icon: TestTube, x: 12, y: 88, s: 38, d: 12, delay: -2, tone: BRAND },
  { Icon: Bandage, x: 66, y: 20, s: 36, d: 9, delay: -4, tone: ROSE, wide: true },
  { Icon: Tablets, x: 28, y: 22, s: 34, d: 14, delay: -11, tone: VIOLET, wide: true },
  { Icon: Eye, x: 96, y: 8, s: 34, d: 10, delay: -5, tone: BRAND, wide: true },
  { Icon: FlaskConical, x: 56, y: 94, s: 34, d: 13, delay: -7, tone: BLUE, wide: true },
];

// One heartbeat, repeated across the width.
const BEAT = 'h40 l8 -2 l6 4 l6 -34 l7 58 l6 -30 l5 4 h40';
const ECG_PATH = `M0 40 ${Array.from({ length: 9 }, () => BEAT).join(' ')}`;

/** Decorative floating medical icons + a travelling ECG trace. Sits behind the page content. */
export default function MedicalBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <svg className="absolute bottom-[6%] left-0 h-20 w-full" viewBox="0 0 1000 80" preserveAspectRatio="none">
        <path d={ECG_PATH} pathLength="1000" className="fill-none stroke-brand-500/10" strokeWidth="1.5" />
        <path d={ECG_PATH} pathLength="1000" className="med-ecg fill-none stroke-brand-500/60" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {ITEMS.map(({ Icon, x, y, s, d, delay, tone, beat, wide }, i) => (
        <div
          key={i}
          className={`med-float absolute ${wide ? 'hidden sm:block' : ''} ${tone}`}
          style={{
            left: `${x}%`,
            top: `${y}%`,
            '--dx': `${i % 2 ? 14 : -14}px`,
            '--dy': `${i % 3 ? -22 : -30}px`,
            '--r0': `${(i * 37) % 30 - 15}deg`,
            '--r1': `${(i * 37) % 30 - 15 + (i % 2 ? 12 : -12)}deg`,
            animationDuration: `${d}s`,
            animationDelay: `${delay}s`,
          }}
        >
          <Icon className={beat ? 'med-beat' : undefined} style={{ width: s, height: s }} strokeWidth={1.6} />
        </div>
      ))}
    </div>
  );
}
