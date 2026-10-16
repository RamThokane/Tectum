import { useCallback, useEffect, useRef, useState } from 'react';
import { Captions, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import FilmFrame, { GEO, captionsOnTop } from './FilmFrame';
import { CUES, FILM_DURATION, NARRATION, SFX } from './filmScript';
import { cn } from '../../lib/format';

/*
 * The landing-page film player. Plays by itself (muted) once ~35% of it is on screen, pauses when
 * it scrolls away or the tab is hidden, and stops on its final frame. Sound (the narration
 * recording, optional music, soft interface sounds) only after the visitor turns it on; that
 * choice is kept for the browser session. Captions are on by default. With reduced motion it
 * waits for Play.
 */

const MUSIC = '/film/music.mp3';

const store = {
  get: (k) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      /* private mode: just don't remember */
    }
  },
};

/** True when the file exists and is audio (a missing file comes back as the app's HTML page). */
async function isAudio(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok && (r.headers.get('content-type') || '').startsWith('audio');
  } catch {
    return false;
  }
}

/** Soft, quiet interface sounds, made on the fly (no files). */
function playSfx(ctx, kind) {
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  if (kind === 'whoosh') {
    const len = 0.4;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.7;
    band.frequency.setValueAtTime(500, now);
    band.frequency.exponentialRampToValueAtTime(2200, now + len);
    gain.gain.value = 0.02;
    src.connect(band);
    band.connect(gain);
    src.start(now);
    return;
  }
  const chime = kind === 'chime';
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(chime ? 0.03 : 0.02, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (chime ? 0.7 : 0.09));
  (chime ? [660, 990] : [1250]).forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(gain);
    o.start(now + i * 0.07);
    o.stop(now + 0.8);
  });
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

export default function TectumFilm() {
  const reduced = useReducedMotion();
  const outerRef = useRef(null);
  const [box, setBox] = useState({ layout: 'wide', width: 0 });
  const [t, setT] = useState(() => (reduced ? FILM_DURATION : 0));
  const tRef = useRef(t);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const autoPaused = useRef(false);
  const inView = useRef(false);

  const [voiceReady, setVoiceReady] = useState(false);
  const [musicReady, setMusicReady] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const soundRef = useRef(false);
  soundRef.current = soundOn && voiceReady;
  const [cc, setCc] = useState(() => store.get('tectum-film-cc') !== '0');
  const [controls, setControls] = useState(true);
  const hideTimer = useRef(null);

  const voice = useRef(null);
  const music = useRef(null);
  const audioCtx = useRef(null);

  // ---- size: 16:9 on wide screens, 4:5 (max 520px wide) on narrow ones
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const layout = w >= 860 ? 'wide' : 'tall';
      setBox({ layout, width: layout === 'wide' ? w : Math.min(w, 520) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const g = GEO[box.layout];
  const scale = box.width ? box.width / g.w : 0;

  // ---- is the narration there? (the film works without it, captions only)
  useEffect(() => {
    let alive = true;
    isAudio(NARRATION.src).then((ok) => {
      if (!alive || !ok) return;
      setVoiceReady(true);
      if (store.get('tectum-film-sound') === '1') setSoundOn(true); // turned on earlier this session
    });
    isAudio(MUSIC).then((ok) => alive && ok && setMusicReady(true));
    return () => {
      alive = false;
    };
  }, []);

  // Create the audio elements once sound is wanted (nothing downloads before that).
  useEffect(() => {
    if (!soundOn || !voiceReady) return;
    if (!voice.current) {
      voice.current = new Audio(NARRATION.src);
      voice.current.preload = 'auto';
    }
    if (musicReady && !music.current) {
      music.current = new Audio(MUSIC);
      music.current.loop = true;
      music.current.preload = 'auto';
    }
  }, [soundOn, voiceReady, musicReady]);

  const silence = useCallback(() => {
    voice.current?.pause();
    music.current?.pause();
  }, []);

  const blocked = useCallback((err) => {
    // The browser refused sound without a click: carry on muted, Sound On is still there.
    if (err?.name === 'NotAllowedError') setSoundOn(false);
  }, []);

  /** Keeps the narration and music in step with the film's clock. */
  const syncAudio = useCallback(
    (now) => {
      if (!soundRef.current) return;
      // One recording of the whole script: it should be at (film time - offset).
      const a = voice.current;
      if (a) {
        const want = now - NARRATION.offset;
        const len = Number.isFinite(a.duration) ? a.duration : FILM_DURATION;
        if (want >= 0 && want < len) {
          if (a.paused) {
            a.currentTime = want;
            a.play().catch(blocked);
          } else if (a.readyState >= 3 && Math.abs(a.currentTime - want) > 0.4) {
            a.currentTime = want; // drifted (e.g. after a network stall): catch up
          }
        } else if (!a.paused) a.pause();
      }
      const m = music.current;
      if (m) {
        m.volume = 0.12 * Math.min(1, Math.max(0, (FILM_DURATION - now) / 3));
        if (m.paused) m.play().catch(blocked);
      }
    },
    [blocked]
  );

  // ---- the clock
  useEffect(() => {
    if (!playing) return undefined;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const prev = tRef.current;
      const next = Math.min(FILM_DURATION, prev + dt);
      tRef.current = next;
      syncAudio(next);
      if (soundRef.current && audioCtx.current) {
        for (const [at, kind] of SFX) if (prev < at && next >= at) playSfx(audioCtx.current, kind);
      }
      setT(next);
      if (next >= FILM_DURATION) {
        setPlaying(false); // rest on the final frame
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, syncAudio]);

  useEffect(() => {
    if (!playing || !soundOn) silence();
  }, [playing, soundOn, silence]);

  const seek = useCallback((to) => {
    tRef.current = to;
    setT(to);
    voice.current?.pause();
  }, []);

  const play = useCallback(() => {
    if (tRef.current >= FILM_DURATION) seek(0);
    setStarted(true);
    setPlaying(true);
  }, [seek]);
  const pause = useCallback((auto = false) => {
    autoPaused.current = auto;
    setPlaying(false);
  }, []);
  const toggle = () => (playing ? pause() : play());
  const replay = () => {
    seek(0);
    setStarted(true);
    setPlaying(true);
  };

  // ---- autoplay when ~35% is on screen; pause when it leaves or the tab is hidden
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= 0.35) {
          inView.current = true;
          if (!started && !reduced) play();
          else if (autoPaused.current) {
            autoPaused.current = false;
            play();
          }
        } else if (e.intersectionRatio < 0.15) {
          inView.current = false;
          if (playing) pause(true);
        }
      },
      { threshold: [0, 0.15, 0.35] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [started, reduced, playing, play, pause]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden && playing) pause(true);
      else if (!document.hidden && autoPaused.current && inView.current) {
        autoPaused.current = false;
        play();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [playing, play, pause]);

  useEffect(() => () => silence(), [silence]);

  // ---- controls fade away while it plays
  const wake = useCallback(() => {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 2500);
  }, []);
  useEffect(() => {
    if (playing) wake();
    else {
      clearTimeout(hideTimer.current);
      setControls(true);
    }
    return () => clearTimeout(hideTimer.current);
  }, [playing, wake]);

  const toggleSound = () => {
    const on = !soundOn;
    if (on && !audioCtx.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx.current = new Ctx();
    }
    audioCtx.current?.resume?.();
    setSoundOn(on);
    store.set('tectum-film-sound', on ? '1' : '0');
    if (on && !playing && tRef.current < FILM_DURATION) play();
  };
  const toggleCc = () => {
    setCc((v) => {
      store.set('tectum-film-cc', v ? '0' : '1');
      return !v;
    });
  };

  // Developer hook for frame-by-frame checks (never in the live build).
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__tectumFilm = {
      seek: (s) => {
        setPlaying(false);
        setStarted(true);
        seek(s);
      },
      speaking: () => (voice.current && !voice.current.paused ? `voice@${voice.current.currentTime.toFixed(2)}` : 'silent'),
    };
    return () => delete window.__tectumFilm;
  }, [seek]);

  const cue = CUES.find((c) => t >= c.start && t < c.end + 0.5);
  const ended = t >= FILM_DURATION;
  const showControls = controls || !playing;
  const onTop = captionsOnTop(t, box.layout);
  const edgeToEdge = box.layout === 'tall' && box.width < 480; // phones: full width, square corners
  const iconBtn = 'ds-focus flex size-10 items-center justify-center rounded-full text-white transition hover:bg-white/15';

  return (
    <div ref={outerRef} className="w-full">
      <div
        role="region"
        aria-label="Tectum in one minute: a short film"
        tabIndex={0}
        onPointerMove={playing ? wake : undefined}
        onFocus={wake}
        onClick={(e) => {
          if (e.target.closest('a, button')) return;
          wake();
          toggle();
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === ' ' || e.key === 'k') {
            e.preventDefault();
            toggle();
          } else if (e.key === 'm' && voiceReady) toggleSound();
          else if (e.key === 'c') toggleCc();
        }}
        className={cn(
          'ds-focus relative mx-auto cursor-pointer select-none overflow-hidden bg-[#0a1222]',
          edgeToEdge ? 'rounded-none' : 'rounded-[20px] shadow-[0_24px_60px_-28px_rgba(10,18,34,.55)] ring-1 ring-black/5'
        )}
        style={{ width: box.width || '100%', height: box.width ? g.h * scale : undefined, aspectRatio: box.width ? undefined : '16 / 9' }}
      >
        {scale > 0 && (
          <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: g.w, height: g.h, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
            <FilmFrame t={t} layout={box.layout} still={reduced} />
          </div>
        )}

        {/* captions */}
        {cc && cue && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 flex justify-center px-4"
            style={onTop ? { top: 12 } : { bottom: 14 + (showControls ? 44 : 0) }}
          >
            <p
              key={cue.id}
              className={cn('animate-[fade-in_.25s_ease-out] max-w-[46rem] rounded-[8px] bg-[#080d19]/85 px-3 py-1.5 text-center font-ui text-white', box.layout === 'wide' ? 'text-[17px] leading-[24px]' : 'text-[14px] leading-[20px]')}
            >
              {cue.text}
            </p>
          </div>
        )}

        {/* Browsers only allow sound after a tap, so it starts muted with a clear way to turn it on. */}
        {voiceReady && !soundOn && started && (
          <button
            onClick={toggleSound}
            className="ds-focus absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3.5 py-2 text-[13px] font-semibold text-white backdrop-blur transition hover:bg-black/75"
          >
            <VolumeX className="size-4" /> Tap for sound
          </button>
        )}

        {/* first visit with reduced motion: nothing moves until asked */}
        {reduced && !started && (
          <button onClick={play} className="ds-focus absolute left-1/2 top-4 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[15px] font-semibold text-[#1d4ed8] shadow-lg">
            <Play className="size-4" fill="currentColor" /> Play the 1-minute film
          </button>
        )}

        {/* controls */}
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/55 to-transparent px-3 pb-2.5 pt-8 transition-opacity duration-300',
            showControls ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <button className={iconBtn} onClick={ended ? replay : toggle} aria-label={ended ? 'Replay' : playing ? 'Pause' : 'Play'}>
            {ended ? <RotateCcw className="size-5" /> : playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="size-5" fill="currentColor" />}
          </button>
          {voiceReady && (
            <button className={cn(iconBtn, 'w-auto gap-1.5 px-3 text-[13px] font-medium')} onClick={toggleSound} aria-pressed={soundOn} aria-label={soundOn ? 'Sound off' : 'Sound on'}>
              {soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
              {!soundOn && <span>Sound on</span>}
            </button>
          )}
          <button className={cn(iconBtn, cc ? 'text-white' : 'text-white/55')} onClick={toggleCc} aria-pressed={cc} aria-label="Captions">
            <Captions className="size-5" />
          </button>
          {!ended && started && t > 1 && (
            <button className={iconBtn} onClick={replay} aria-label="Start again">
              <RotateCcw className="size-[18px]" />
            </button>
          )}
          <span className="ml-auto pr-1 font-code text-[12px] text-white/70" aria-hidden="true">
            {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, '0')} / 1:{String(FILM_DURATION - 60).padStart(2, '0')}
          </span>
        </div>
        {/* progress line */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/10" aria-hidden="true">
          <div className="h-full bg-[#8fb0ff]" style={{ width: `${(t / FILM_DURATION) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
