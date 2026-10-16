import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Bookmark, ChevronRight, CircleCheck, HelpCircle, ShieldCheck } from 'lucide-react';
import { CASE, T } from './filmScript';
import { camera, clamp01, ease, prog, rise, span } from './motion';

/*
 * One frame of the landing-page film, drawn from the time t (seconds). Two compositions:
 * "wide" (16:9, case on the left and a side panel on the right) and "tall" (4:5 for phones, the
 * side panel becomes a bottom sheet like the app's). Sizes are in stage pixels; the player scales
 * the stage to fit. The film keeps its own colours, so it looks the same in light and dark mode.
 */

const C = {
  night: '#0a1222',
  paper: '#eef1f5',
  card: '#ffffff',
  line: '#e2e6ec',
  ink: '#0e1726',
  muted: '#5b6474',
  faint: '#8a93a3',
  brand: '#2563eb',
  brandText: '#1d4ed8',
  brandSoft: 'rgba(37,99,235,.10)',
  brandLight: '#8fb0ff',
  coral: '#f97362',
  success: '#15803d',
  successSoft: '#e4f3e8',
  warn: '#9a5b0b',
  warnSoft: '#fbf1df',
};

const SHADOW = '0 1px 2px rgba(15,23,42,.05), 0 18px 40px -18px rgba(15,23,42,.28)';

export const GEO = {
  wide: {
    w: 1120,
    h: 630,
    card: { x: 80, y: 56, w: 560, pad: 28 },
    side: { x: 690, y: 56, w: 350 },
    title: [30, 36],
    body: [16, 24],
    dx: [22, 28],
    hook: [50, 58],
    final: [48, 56],
    eyebrow: 11.5,
    // [time, focus x, focus y, zoom]
    cam: [
      [0, 360, 262, 1.18],
      [10.4, 360, 268, 1.18],
      [16.4, 360, 296, 1.12],
      [21.8, 360, 326, 1.16],
      [23.2, 360, 326, 1.16],
      [24.8, 560, 305, 1],
      [41.0, 560, 305, 1],
      [42.6, 362, 404, 1.12],
      [46.4, 362, 412, 1.12],
      [47.8, 560, 305, 1],
      [51.8, 560, 305, 1],
      [54.4, 560, 300, 0.66],
      [62, 560, 300, 0.63],
    ],
  },
  tall: {
    w: 440,
    h: 550,
    card: { x: 20, y: 52, w: 400, pad: 20 },
    sheet: { x: 12, w: 416, h: 262 },
    title: [22, 28],
    body: [14.5, 21],
    dx: [18, 24],
    hook: [33, 40],
    final: [32, 38],
    eyebrow: 10.5,
    cam: [
      [0, 220, 275, 1],
      [16.4, 220, 275, 1],
      [21.8, 220, 300, 1.04],
      [23.4, 220, 300, 1.04],
      [24.8, 220, 456, 1],
      [41.0, 220, 456, 1],
      [42.6, 220, 556, 1],
      [46.4, 220, 566, 1],
      [51.8, 220, 566, 1],
      [54.4, 220, 480, 0.56],
      [62, 220, 480, 0.54],
    ],
  },
};

/** When the phone layout's bottom sheet is up (0..1). */
const sheetOpen = (t) => Math.max(span(t, 23.4, 41.6, 0.8, 0.7), span(t, 46.7, 52.4, 0.8, 0.7));

/**
 * Phones: captions move to the top while the bottom sheet is up (and in the wider view), where
 * they cover only parts of the case already talked about. Otherwise they sit at the bottom.
 */
export const captionsOnTop = (t, layout) => layout === 'tall' && (sheetOpen(t) > 0.5 || (t >= T.value + 0.5 && t < T.close));

const eyebrowStyle = (g, color = C.faint) => ({
  fontSize: g.eyebrow,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 600,
  color,
});

/** A highlighter stroke that sweeps across a clue. */
function Mark({ t, at, tone = 'brand', children }) {
  const p = prog(t, at, 0.6);
  const bg = tone === 'coral' ? 'rgba(249,115,98,.24)' : 'rgba(37,99,235,.15)';
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(${bg},${bg})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${p * 100}% 100%`,
        borderRadius: 4,
        padding: '1px 3px',
        margin: '0 -3px',
        boxDecorationBreak: 'clone',
        WebkitBoxDecorationBreak: 'clone',
        color: p > 0.5 ? (tone === 'coral' ? '#b23f2b' : C.brandText) : undefined,
        fontWeight: p > 0.5 ? 600 : undefined,
      }}
    >
      {children}
    </span>
  );
}

// ------------------------------------------------------------------ opening line
function Hook({ t, g, still }) {
  const [size, lh] = g.hook;
  const line = (inAt, outAt) => {
    const pin = prog(t, inAt, 0.8);
    const pout = outAt ? ease(clamp01((t - outAt) / 0.55)) : 0;
    return still ? { opacity: Math.min(pin, 1 - pout) } : { transform: `translateY(${(1 - pin) * 110 - pout * 110}%)` };
  };
  const strike = prog(t, 2.9, 0.5);
  const under = prog(t, 4.7, 0.8);
  const leave = ease(clamp01((t - T.open) / 0.8));
  const mask = { height: lh, overflow: 'hidden', position: 'relative' };
  return (
    <>
      <div
        className="font-editorial"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: g.h / 2 + 16,
          textAlign: 'center',
          color: '#fff',
          fontSize: size,
          lineHeight: `${lh}px`,
          fontWeight: 400,
          letterSpacing: '-0.02em',
          opacity: 1 - leave,
          transform: still ? undefined : `translateY(${-leave * 26}px)`,
        }}
      >
        <div style={mask}>
          <div style={line(0.4, T.hookSwap)}>Medicine isn&rsquo;t learned</div>
        </div>
        <div style={mask}>
          <div style={{ ...line(0.75, T.hookSwap + 0.1), position: 'absolute', inset: 0 }}>
            from{' '}
            <span style={{ position: 'relative', whiteSpace: 'nowrap' }}>
              answers alone
              <span style={{ position: 'absolute', left: 0, top: '56%', height: Math.max(2, size / 18), width: `${strike * 100}%`, background: C.coral, borderRadius: 2 }} />
            </span>
            .
          </div>
          <div style={{ ...line(4.0, null), position: 'absolute', inset: 0 }}>
            Learn from <span style={{ fontStyle: 'italic', color: C.brandLight }}>real cases.</span>
          </div>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: g.h / 2 - 1,
          height: 2,
          width: under * (g.w * 0.42),
          transform: 'translateX(-50%)',
          background: C.brandLight,
          opacity: 1 - leave,
        }}
      />
    </>
  );
}

// ------------------------------------------------------------------ the case
function CaseCard({ t, g, still, layout }) {
  const refs = useRef([]);
  const [bottoms, setBottoms] = useState(null);
  useLayoutEffect(() => {
    let alive = true;
    const measure = () => alive && setBottoms(refs.current.map((el) => (el ? el.offsetTop + el.offsetHeight : 0)));
    measure();
    document.fonts?.ready.then(measure);
    return () => {
      alive = false;
    };
  }, [layout]);

  const steps = [T.eyebrow, T.title, T.complaint, T.exam, T.labs, T.diagnosis, T.why];
  const ps = steps.map((s) => prog(t, s, 0.9));
  // The card grows as each part of the case arrives.
  let h = 0;
  if (bottoms) bottoms.forEach((b, i) => (h += (b - h) * ps[i]));
  const { x, y, w, pad } = g.card;
  const [bs, bl] = g.body;
  const section = (i, label, body, extra) => (
    <div ref={(el) => (refs.current[i] = el)} style={{ paddingTop: i === 5 ? bs * 1.4 : bs * 1.1 }}>
      <div style={rise(ps[i], still)}>
        <p style={eyebrowStyle(g)}>{label}</p>
        <div style={{ marginTop: 4, fontSize: bs, lineHeight: `${bl}px`, ...extra }}>{body}</div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: bottoms ? h + pad * 2 : undefined,
        padding: pad,
        boxSizing: 'border-box',
        background: C.card,
        border: `1px solid ${C.line}`,
        borderRadius: 20,
        boxShadow: SHADOW,
        overflow: 'hidden',
        opacity: prog(t, T.open + 0.5, 0.8),
      }}
    >
      <div style={{ position: 'relative' }}>
        <div ref={(el) => (refs.current[0] = el)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...rise(ps[0], still, 8) }}>
          <span style={eyebrowStyle(g, C.brandText)}>Case Rounds · {CASE.specialty}</span>
          <span className="font-code" style={{ fontSize: g.eyebrow + 1, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 999, padding: '2px 9px', opacity: ps[1] }}>
            {CASE.ageSex}
          </span>
        </div>
        <div ref={(el) => (refs.current[1] = el)} style={{ paddingTop: bs * 0.8 }}>
          <h3
            className="font-editorial"
            style={{
              fontSize: g.title[0],
              lineHeight: `${g.title[1]}px`,
              fontWeight: 500,
              letterSpacing: '-0.015em',
              clipPath: still ? undefined : `inset(0 ${(1 - ps[1]) * 100}% 0 0)`,
              opacity: still ? ps[1] : 1,
            }}
          >
            {CASE.title}
          </h3>
          <p style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, fontSize: bs - 3, color: C.faint, opacity: prog(t, T.title + 0.5, 0.8) }}>
            <ShieldCheck size={bs - 2} strokeWidth={1.5} /> De-identified case · posted for teaching
          </p>
        </div>
        {section(2, 'Presenting complaint', CASE.complaint)}
        {section(
          3,
          'Examination',
          <>
            <Mark t={t} at={T.marks[0]}>HR 52</Mark>, <Mark t={t} at={T.marks[1]}>BP 88/60</Mark>, <Mark t={t} at={T.marks[2]}>JVP raised</Mark>,{' '}
            <Mark t={t} at={T.marks[3]} tone="coral">clear lung fields</Mark>.
          </>
        )}
        {section(
          4,
          'Labs / Images',
          <>
            ECG: ST elevation in <Mark t={t} at={T.leads}>II, III and aVF</Mark>.
          </>,
          { fontFamily: 'var(--font-code)', fontSize: bs - 1 }
        )}
        {section(5, 'Diagnosis', CASE.diagnosis, { fontFamily: 'var(--font-editorial)', fontSize: g.dx[0], lineHeight: `${g.dx[1]}px`, fontWeight: 500 })}
        <div ref={(el) => (refs.current[6] = el)} style={{ paddingTop: bs }}>
          <div style={{ ...rise(ps[6], still), background: C.warnSoft, borderRadius: 12, padding: bs * 0.85 }}>
            <p style={eyebrowStyle(g, C.warn)}>Why</p>
            <p style={{ marginTop: 3, fontSize: bs - 0.5, lineHeight: `${bl - 1}px` }}>{CASE.why}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ side panels
/** Slides in from the right at a, out to the left before b. */
function slide(t, a, b, still) {
  const pin = prog(t, a, 0.7);
  const pout = b ? ease(clamp01((t - (b - 0.55)) / 0.55)) : 0;
  return { opacity: Math.min(pin, 1 - pout), transform: still ? undefined : `translateX(${(1 - pin) * 36 - pout * 36}px)` };
}

const panelHead = (g, label, icon) => (
  <p style={{ ...eyebrowStyle(g), display: 'flex', alignItems: 'center', gap: 6 }}>
    {icon}
    {label}
  </p>
);

/** Leads II, III and aVF, each drawing in, with the ST segments marked. */
function EcgPanel({ t, g, compact }) {
  const beat = (x) =>
    `L${x + 12},34 Q${x + 17},28 ${x + 22},34 L${x + 30},34 L${x + 33},38 L${x + 38},6 L${x + 43},41 L${x + 46},24 C${x + 56},19 ${x + 68},14 ${x + 78},30 L${x + 84},34 L${x + 110},34`;
  const beats = [0, 110, 220, 330];
  const path = `M0,34 ${beats.map(beat).join(' ')}`;
  const vw = compact ? 380 : 300; // wider strip on phones keeps it short
  const st = prog(t, T.leads, 0.6);
  return (
    <div>
      {panelHead(g, 'ECG · inferior leads')}
      <div style={{ marginTop: compact ? 8 : 10, display: 'grid', gap: compact ? 6 : 8 }}>
        {['II', 'III', 'aVF'].map((lead, i) => {
          const d = prog(t, T.labs + 0.5 + i * 0.35, 1.6);
          return (
            <div key={lead} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#fff7f5', border: '1px solid #f4dcd6' }}>
              <span className="font-code" style={{ position: 'absolute', left: 8, top: 4, fontSize: 11, color: '#b4574a' }}>{lead}</span>
              <svg viewBox={`0 0 ${vw} 48`} style={{ display: 'block', width: '100%', height: 'auto' }} aria-hidden="true">
                <defs>
                  <pattern id={`film-ecg-${lead}`} width="6" height="6" patternUnits="userSpaceOnUse">
                    <path d="M6 0H0V6" fill="none" stroke="#f3cfc8" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width={vw} height="48" fill={`url(#film-ecg-${lead})`} />
                {beats.filter((x) => x + 44 < vw).map((x) => (
                  <rect key={x} x={x + 44} y="10" width="26" height="26" rx="3" fill={C.coral} opacity={0.2 * st} />
                ))}
                <path d={path} fill="none" stroke="#1f2937" strokeWidth="1.6" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - d} />
              </svg>
            </div>
          );
        })}
      </div>
      <p style={{ marginTop: 10, fontSize: 13, color: C.muted, opacity: st }}>
        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'rgba(249,115,98,.35)', marginRight: 6, verticalAlign: '-1px' }} />
        ST elevation in II, III and aVF
      </p>
    </div>
  );
}

/** "What's your diagnosis?" The learner commits, then the answer is shown (no vote numbers). */
function PollPanel({ t, compact }) {
  const pick = prog(t, T.pick, 0.35);
  const rv = prog(t, T.reveal, 0.7);
  const press = 1 - 0.025 * Math.sin(Math.PI * clamp01((t - T.pick) / 0.35));
  return (
    <div>
      <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: compact ? 14 : 15, fontWeight: 600 }}>
        <HelpCircle size={17} strokeWidth={1.5} color={C.brand} /> What&rsquo;s your diagnosis?
      </p>
      <div style={{ marginTop: compact ? 8 : 12, display: 'grid', gap: compact ? 6 : 8 }}>
        {CASE.options.map((o, i) => {
          const correct = i === CASE.correct;
          const mine = i === CASE.correct && t >= T.pick;
          return (
            <div
              key={o}
              style={{
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minHeight: compact ? 40 : 46,
                padding: compact ? '6px 10px' : '8px 12px',
                borderRadius: 12,
                background: C.card,
                border: `1.5px solid ${correct && rv > 0.2 ? '#86c79a' : mine ? C.brand : C.line}`,
                fontSize: compact ? 13 : 14,
                fontWeight: 500,
                lineHeight: '18px',
                opacity: correct ? 1 : 1 - 0.5 * rv,
                transform: mine ? `scale(${press})` : undefined,
              }}
            >
              {correct && <div style={{ position: 'absolute', inset: 0, width: `${rv * 100}%`, background: C.successSoft }} />}
              <span
                className="font-code"
                style={{
                  position: 'relative',
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  border: `1px solid ${mine ? C.brand : C.line}`,
                  background: mine ? C.brand : 'transparent',
                  color: mine ? '#fff' : C.faint,
                }}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span style={{ position: 'relative', flex: 1, color: correct && rv > 0.4 ? C.success : C.ink }}>{o}</span>
              {mine && rv < 0.3 && <span style={{ position: 'relative', fontSize: 11, color: C.brandText, opacity: pick, whiteSpace: 'nowrap' }}>Your answer</span>}
              {correct && rv >= 0.3 && <CircleCheck size={18} color={C.success} strokeWidth={1.75} style={{ position: 'relative', opacity: rv }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The clues come together into the answer. */
function ReasonPanel({ t, g, compact }) {
  const clues = ['ST elevation in II, III and aVF', 'BP 88/60 with HR 52', 'Raised JVP, clear lungs'];
  const join = prog(t, T.joins, 1.0);
  const pt = prog(t, T.points, 0.8);
  return (
    <div>
      {panelHead(g, 'Putting it together')}
      <div style={{ position: 'relative', marginTop: compact ? 10 : 14, paddingLeft: 22 }}>
        <div style={{ position: 'absolute', left: 7, top: 16, bottom: compact ? 28 : 34, width: 1.5, background: C.brand, transform: `scaleY(${join})`, transformOrigin: 'top' }} />
        {clues.map((c, i) => {
          const p = prog(t, T.clues[i], 0.6);
          return (
            <div key={c} style={{ position: 'relative', marginBottom: compact ? 7 : 10, opacity: p, transform: `translateX(${(1 - p) * 12}px)` }}>
              <span style={{ position: 'absolute', left: -15, top: '50%', width: 15 * join, height: 1.5, background: C.brand }} />
              <div style={{ display: 'inline-block', padding: compact ? '6px 10px' : '8px 12px', borderRadius: 10, background: '#f4f6f9', border: `1px solid ${C.line}`, fontSize: compact ? 13 : 14, fontWeight: 500 }}>{c}</div>
            </div>
          );
        })}
        <div style={{ position: 'relative', marginTop: compact ? 10 : 16, padding: compact ? '8px 12px' : '12px 14px', borderRadius: 12, border: `1.5px solid ${C.brand}`, background: C.brandSoft, opacity: pt, transform: `translateY(${(1 - pt) * 8}px)` }}>
          <span style={{ position: 'absolute', left: -15, top: '50%', width: 15 * pt, height: 1.5, background: C.brand }} />
          <p style={eyebrowStyle(g, C.brandText)}>Points to</p>
          <p className="font-editorial" style={{ fontSize: compact ? 18 : 21, lineHeight: compact ? '23px' : '27px', fontWeight: 500 }}>Right ventricular involvement</p>
        </div>
      </div>
    </div>
  );
}

/** Saved to the Notebook, then back as a spaced-repetition flashcard. */
function FlashPanel({ t, g, compact }) {
  const saved = prog(t, T.saved, 0.5);
  const flip = ease(clamp01((t - T.flip) / 0.8));
  const card = prog(t, T.saved + 0.5, 0.7);
  const face = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderRadius: 14, border: `1px solid ${C.line}`, background: C.card, padding: compact ? 14 : 18, display: 'flex', flexDirection: 'column', justifyContent: 'center' };
  return (
    <div>
      <p style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.brandText, opacity: saved }}>
        <Bookmark size={15} fill={C.brand} color={C.brand} /> Saved to Notebook
      </p>
      <div style={{ marginTop: compact ? 8 : 12, height: compact ? 128 : 170, perspective: 900, opacity: card }}>
        <div style={{ position: 'relative', height: '100%', transformStyle: 'preserve-3d', transform: `rotateY(${flip * 180}deg)` }}>
          <div style={face}>
            <p style={eyebrowStyle(g)}>Flashcard · {CASE.specialty}</p>
            <p className="font-editorial" style={{ marginTop: 6, fontSize: compact ? 16 : 19, lineHeight: compact ? '21px' : '25px', fontWeight: 500 }}>
              Inferior STEMI with low BP, a raised JVP and clear lungs. What else is involved?
            </p>
          </div>
          <div style={{ ...face, transform: 'rotateY(180deg)' }}>
            <p style={eyebrowStyle(g, C.success)}>Answer</p>
            <p className="font-editorial" style={{ marginTop: 4, fontSize: compact ? 19 : 23, lineHeight: compact ? '24px' : '29px', fontWeight: 500 }}>The right ventricle</p>
            <p style={{ marginTop: 6, fontSize: compact ? 12.5 : 13.5, lineHeight: '18px', color: C.muted }}>Avoid nitrates. Give fluids cautiously and arrange reperfusion.</p>
          </div>
        </div>
      </div>
      <div style={{ marginTop: compact ? 8 : 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {['Again', 'Hard', 'Good', 'Easy'].map((b, i) => {
          const p = prog(t, T.grade + i * 0.08, 0.4);
          const on = b === 'Good' && t >= T.good;
          return (
            <span key={b} style={{ textAlign: 'center', padding: compact ? '7px 0' : '9px 0', borderRadius: 999, fontSize: 13, fontWeight: 500, border: `1px solid ${on ? C.brand : C.line}`, background: on ? C.brand : C.card, color: on ? '#fff' : C.ink, opacity: p, transform: `translateY(${(1 - p) * 6}px)` }}>
              {b}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function SidePanels({ t, g, compact, still, until }) {
  return (
    <div style={{ position: 'relative' }}>
      {t >= T.labs && t < T.poll + 0.1 && (
        <div style={{ position: 'absolute', inset: '0 0 auto 0', ...slide(t, T.labs, T.poll, still) }}>
          <EcgPanel t={t} g={g} compact={compact} />
        </div>
      )}
      {t >= T.poll - 0.1 && t < T.reason + 0.1 && (
        <div style={{ position: 'absolute', inset: '0 0 auto 0', ...slide(t, T.poll, T.reason, still) }}>
          <PollPanel t={t} compact={compact} />
        </div>
      )}
      {t >= T.reason - 0.1 && t < T.diagnosis && (
        <div style={{ position: 'absolute', inset: '0 0 auto 0', ...slide(t, T.reason, T.diagnosis, still) }}>
          <ReasonPanel t={t} g={g} compact={compact} />
        </div>
      )}
      {t >= T.saved - 0.1 && t < until && (
        <div style={{ position: 'absolute', inset: '0 0 auto 0', ...slide(t, T.saved, null, still) }}>
          <FlashPanel t={t} g={g} compact={compact} />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ the wider view
const WARDS = [
  ['Anatomy', '#f59e0b'],
  ['Physiology', '#ec4899'],
  ['Pharmacology', '#10b981'],
  ['Pathology', '#8b5cf6'],
  ['Cardiology', '#f43f5e'],
  ['Pediatrics', '#0ea5e9'],
  ['Surgery', '#3b82f6'],
];

const boxStyle = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, boxShadow: SHADOW };

function WardsPanel({ g, chips }) {
  return (
    <div style={{ ...boxStyle, padding: chips ? 16 : 20 }}>
      <p style={eyebrowStyle(g)}>Wards</p>
      <div style={chips ? { marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 } : { marginTop: 10, display: 'grid', gap: 2 }}>
        {WARDS.map(([name, dot]) => (
          <span key={name} style={chips ? { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px', borderRadius: 999, border: `1px solid ${C.line}`, fontSize: 13 } : { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', fontSize: 15, borderBottom: `1px solid ${C.line}` }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: dot }} />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

function DiscussionPanel({ g, compact }) {
  const comments = [
    { who: 'Cardiologist', verified: true, text: 'Get right-sided leads too. ST elevation in V4R supports RV infarction.' },
    { who: 'Final-year student', text: 'The clear lungs threw me. I went for PE first.' },
  ];
  return (
    <div style={{ ...boxStyle, padding: compact ? 16 : 20 }}>
      <p style={eyebrowStyle(g)}>Discussion</p>
      {comments.map((c, i) => (
        <div key={c.who} style={{ display: 'flex', gap: 10, marginTop: 12, paddingTop: i ? 12 : 0, borderTop: i ? `1px solid ${C.line}` : undefined }}>
          <span style={{ width: 28, height: 28, borderRadius: 99, flexShrink: 0, background: i ? '#dbe4f3' : '#cfe0ff' }} />
          <div>
            <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
              {c.who}
              {c.verified && <BadgeCheck size={15} fill={C.brand} color="#fff" />}
              {c.verified && <span style={{ fontSize: 11.5, fontWeight: 500, color: C.brandText }}>Verified</span>}
            </p>
            <p style={{ marginTop: 2, fontSize: 13.5, lineHeight: '19px', color: '#2b3444' }}>{c.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function OtherCase({ g, specialty, title, line }) {
  return (
    <div style={{ ...boxStyle, padding: g.card.pad }}>
      <p style={eyebrowStyle(g, C.brandText)}>Case Rounds · {specialty}</p>
      <p className="font-editorial" style={{ marginTop: 8, fontSize: g.title[0] - 6, lineHeight: `${g.title[1] - 6}px`, fontWeight: 500 }}>{title}</p>
      <p style={{ marginTop: 6, fontSize: g.body[0] - 1, color: C.muted }}>{line}</p>
    </div>
  );
}

function Wider({ t, g, layout }) {
  const p = prog(t, T.value + 0.5, 1.2);
  const at = (x, y, w, extra) => ({ position: 'absolute', left: x, top: y, width: w, opacity: p, ...extra });
  if (layout === 'tall') {
    return (
      <>
        <div style={at(20, 612, 400)}>
          <WardsPanel g={g} chips />
        </div>
        <div style={at(20, 738, 400)}>
          <DiscussionPanel g={g} compact />
        </div>
      </>
    );
  }
  return (
    <>
      <div style={at(80, -168, 560)}>
        <OtherCase g={g} specialty="Gastroenterology" title="Progressive dysphagia to solids and liquids" line="Regurgitation of undigested food for 6 months." />
      </div>
      <div style={at(80, 690, 560)}>
        <OtherCase g={g} specialty="Pediatrics" title="A limping 6-year-old with a painful hip" line="Low-grade fever for 3 days, refuses to bear weight." />
      </div>
      <div style={at(-250, 56, 300)}>
        <WardsPanel g={g} />
      </div>
      <div style={at(1070, 56, 310)}>
        <DiscussionPanel g={g} />
      </div>
    </>
  );
}

// ------------------------------------------------------------------ closing frame
function Final({ t, g, still }) {
  const c = ease(clamp01((t - T.close) / 1.0));
  const [size, lh] = g.final;
  const line = (at) => {
    const p = prog(t, at, 0.9);
    return still ? { opacity: p } : { transform: `translateY(${(1 - p) * 110}%)` };
  };
  const logo = prog(t, T.final + 1.3, 0.8);
  const cta = prog(t, T.cta, 0.7);
  const tall = g.w < 600;
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.night, clipPath: `inset(${(1 - c) * 50}% 0)`, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      <div className="font-editorial" style={{ fontSize: size, lineHeight: `${lh}px`, letterSpacing: '-0.02em', fontWeight: 400 }}>
        <div style={{ overflow: 'hidden', height: lh }}>
          <div style={line(T.final)}>Learn medicine</div>
        </div>
        <div style={{ overflow: 'hidden', height: lh }}>
          <div style={{ ...line(T.final + 0.3), fontStyle: 'italic', color: C.brandLight }}>one real case at a time.</div>
        </div>
      </div>
      <div style={{ marginTop: tall ? 22 : 28, display: 'flex', alignItems: 'center', gap: 8, opacity: logo }}>
        <img src="/logo-mark.png" alt="" draggable={false} style={{ width: tall ? 32 : 40, height: tall ? 32 : 40, objectFit: 'contain' }} />
        <span className="wordmark" style={{ fontSize: tall ? 24 : 30, lineHeight: 1, color: '#fff' }}>Tectum</span>
      </div>
      <div style={{ marginTop: tall ? 22 : 30, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, opacity: cta, transform: `translateY(${(1 - cta) * 8}px)`, pointerEvents: t >= T.cta ? 'auto' : 'none' }}>
        {/* mouse/touch shortcuts only: the film is hidden from screen readers, which get the transcript */}
        <Link to="/signup" tabIndex={-1} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 22px', borderRadius: 999, background: '#fff', color: C.brandText, fontSize: tall ? 15 : 16, fontWeight: 600 }}>
          Join free <ChevronRight size={18} />
        </Link>
        <a href="#sample-case" tabIndex={-1} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 22px', borderRadius: 999, border: '1px solid rgba(255,255,255,.45)', color: '#fff', fontSize: tall ? 15 : 16, fontWeight: 500 }}>
          Try a sample case
        </a>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ frame
export default function FilmFrame({ t, layout, still }) {
  const g = GEO[layout];
  const [fx, fy, s] = camera(t, g.cam, still);
  const open = ease(clamp01((t - T.open) / 1.0));
  const sheet = sheetOpen(t);
  const showWorld = t >= T.open && t < T.close + 1.1;
  return (
    <div className="font-ui" style={{ position: 'absolute', left: 0, top: 0, width: g.w, height: g.h, overflow: 'hidden', background: C.night, color: C.ink, textAlign: 'left' }}>
      {/* the opening line sits underneath: the case opens over it */}
      {t < T.open + 1.2 && <Hook t={t} g={g} still={still} />}
      {showWorld && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 25% 15%, rgba(37,99,235,.07), transparent 60%), ${C.paper}`,
            clipPath: `inset(${(1 - open) * 50}% 0)`,
          }}
        >
          <div style={{ position: 'absolute', left: 0, top: 0, width: g.w, height: g.h, transformOrigin: '0 0', transform: `translate(${g.w / 2}px, ${g.h / 2}px) scale(${s}) translate(${-fx}px, ${-fy}px)` }}>
            {t >= T.value && <Wider t={t} g={g} layout={layout} />}
            <CaseCard t={t} g={g} still={still} layout={layout} />
            {layout === 'wide' && t >= T.labs && (
              <div style={{ position: 'absolute', left: g.side.x, top: g.side.y, width: g.side.w, height: 304, ...boxStyle, padding: 20, overflow: 'hidden', opacity: span(t, T.labs, T.diagnosis + 0.2, 0.6, 0.6) || prog(t, T.saved - 0.2, 0.6) }}>
                <SidePanels t={t} g={g} still={still} until={99} />
              </div>
            )}
          </div>
          {/* the film's corner mark (wide only: on phones the case fills the frame) */}
          {layout === 'wide' && <div style={{ position: 'absolute', left: 24, top: 18, display: 'flex', alignItems: 'center', gap: 6, opacity: 0.9 * span(t, T.eyebrow, T.close, 0.8, 0.5) }}>
            <img src="/logo-mark.png" alt="" draggable={false} style={{ width: 22, height: 22, objectFit: 'contain' }} />
            <span className="wordmark" style={{ fontSize: 16, lineHeight: 1, color: C.ink }}>Tectum</span>
          </div>}
          {layout === 'tall' && sheet > 0 && (
            <div
              style={{
                position: 'absolute',
                left: g.sheet.x,
                width: g.sheet.w,
                height: g.sheet.h,
                top: g.h - sheet * (g.sheet.h + 12),
                ...boxStyle,
                padding: '18px 16px 14px',
                overflow: 'hidden',
              }}
            >
              <span style={{ position: 'absolute', left: '50%', top: 7, width: 36, height: 4, marginLeft: -18, borderRadius: 99, background: C.line }} />
              <SidePanels t={t} g={g} compact still={still} until={T.value + 0.7} />
            </div>
          )}
        </div>
      )}
      {t >= T.close && <Final t={t} g={g} still={still} />}
    </div>
  );
}
