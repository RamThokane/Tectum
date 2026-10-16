import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RotateCw, FlipHorizontal2, Undo2 } from 'lucide-react';
import { Modal } from './ui';
import { cn } from '../lib/format';

const MAX_ZOOM = 6;
const MAX_TILT = 45;
const rad = (deg) => (deg * Math.PI) / 180;

/** Crop settings for FileUploadZone's `crop` prop. Covers are shown about 3:1 on profiles. */
export const AVATAR_CROP = { aspect: 1, round: true, title: 'Crop your profile photo', outputWidth: 512 };
export const COVER_CROP = { aspect: 3, round: false, title: 'Crop your cover photo', outputWidth: 1500 };

/**
 * Crop a photo before it's used (profile photo, cover), the way X / Instagram do it: the whole
 * photo stays visible (dimmed) around the crop frame; drag it anywhere, pinch (or the mouse wheel)
 * to zoom in and out, double-tap to zoom in, straighten with the tilt slider, rotate 90° and flip.
 * Zooming out past the frame leaves white space round the photo. `aspect` is width / height of
 * the frame; `round` shows a circle (the saved image stays square). Calls onDone(File).
 */
export default function ImageCropper({ file, aspect = 1, round = false, title = 'Crop photo', outputWidth = 800, onCancel, onDone }) {
  const [src, setSrc] = useState(null);
  const [natural, setNatural] = useState(null); // { w, h }
  const [stage, setStage] = useState({ w: 0, h: 0 }); // the whole touch area
  const [zoom, setZoom] = useState(1); // 1 = photo just covers the frame
  const [off, setOff] = useState({ x: 0, y: 0 }); // photo centre relative to the frame centre
  const [quarter, setQuarter] = useState(0); // 90° turns
  const [tilt, setTilt] = useState(0); // straighten, degrees
  const [flip, setFlip] = useState(false);
  const [moving, setMoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Stage: as wide as the dialog allows; the crop frame sits in its middle with a margin round it.
  useLayoutEffect(() => {
    const el = stageRef.current?.parentElement;
    if (!el) return undefined;
    const measure = () => {
      const w = Math.min(el.clientWidth, round ? 420 : 640);
      // round: kept short enough that the controls still fit on a phone screen
      setStage({ w, h: round ? Math.min(w, 340) : Math.round((w - 32) / aspect) + 96 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect, round]);

  const d = Math.min(stage.w, stage.h) - 48;
  const frame = round ? { w: d, h: d } : { w: stage.w - 32, h: (stage.w - 32) / aspect };
  const angle = quarter * 90 + tilt;
  const c = Math.abs(Math.cos(rad(angle)));
  const s = Math.abs(Math.sin(rad(angle)));

  // Scale at which the turned photo exactly covers the frame (zoom 1), and the smallest zoom
  // (whole photo fits, with some room to spare).
  const base = natural && frame.w > 0 ? Math.max((frame.w * c + frame.h * s) / natural.w, (frame.w * s + frame.h * c) / natural.h) : 1;
  const fit = natural && frame.w > 0 ? Math.min(frame.w / (natural.w * c + natural.h * s), frame.h / (natural.w * s + natural.h * c)) / base : 1;
  const minZoom = Math.min(1, fit) * 0.7;
  const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(minZoom, z));

  /** Keep the photo where it can still be seen: bigger than the frame -> its edges stay outside the frame; smaller -> it stays inside. */
  const clampOff = (o, z = zoom) => {
    if (!natural) return o;
    const k = base * z;
    const bw = (natural.w * c + natural.h * s) * k;
    const bh = (natural.w * s + natural.h * c) * k;
    const lx = Math.abs(bw - frame.w) / 2;
    const ly = Math.abs(bh - frame.h) / 2;
    return { x: Math.min(lx, Math.max(-lx, o.x)), y: Math.min(ly, Math.max(-ly, o.y)) };
  };
  const view = clampOff(off);

  const reset = () => {
    setZoom(1);
    setOff({ x: 0, y: 0 });
    setQuarter(0);
    setTilt(0);
    setFlip(false);
  };
  useEffect(reset, [natural, stage.w, stage.h]);

  /** Zoom keeping the point p (relative to the frame centre) still under the finger / cursor. */
  const zoomAt = (z, p = { x: 0, y: 0 }, from = { zoom, off: view }) => {
    const nz = clampZoom(z);
    const r = nz / from.zoom;
    setZoom(nz);
    setOff(clampOff({ x: p.x - (p.x - from.off.x) * r, y: p.y - (p.y - from.off.y) * r }, nz));
  };

  const local = (e) => {
    const b = stageRef.current.getBoundingClientRect();
    return { x: e.clientX - b.left - b.width / 2, y: e.clientY - b.top - b.height / 2 };
  };
  const startGesture = () => {
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const [a, b] = pts;
      gesture.current = { pinch: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, zoom, off: view };
    } else if (pts.length === 1) {
      gesture.current = { start: pts[0], off: view };
    } else {
      gesture.current = null;
    }
  };
  const onPointerDown = (e) => {
    stageRef.current.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    setMoving(true);
    // double-tap: zoom in there (or back out if already zoomed in)
    if (pointers.current.size === 1) {
      const now = Date.now();
      const t = lastTap.current;
      if (now - t.t < 300 && Math.hypot(p.x - t.x, p.y - t.y) < 30) {
        zoomAt(zoom > 1.6 ? 1 : zoom * 2.2, p);
        lastTap.current = { t: 0, x: 0, y: 0 };
        pointers.current.clear();
        gesture.current = null;
        return;
      }
      lastTap.current = { t: now, ...p };
    }
    startGesture();
  };
  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e));
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    if (!g) return;
    if (pts.length >= 2 && g.pinch) {
      // two fingers: zoom by their spread and move with their midpoint
      const [a, b] = pts;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const nz = clampZoom(g.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / g.pinch));
      const r = nz / g.zoom;
      setZoom(nz);
      setOff(clampOff({ x: mid.x - (g.mid.x - g.off.x) * r, y: mid.y - (g.mid.y - g.off.y) * r }, nz));
    } else if (g.start) {
      const p = pts[0];
      setOff(clampOff({ x: g.off.x + p.x - g.start.x, y: g.off.y + p.y - g.start.y }));
    }
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setMoving(false);
    startGesture(); // the finger still down carries on dragging from where it is
  };
  const onWheel = (e) => zoomAt(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), local(e));
  const onKeyDown = (e) => {
    const step = e.shiftKey ? 30 : 8;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      setOff(clampOff({ x: view.x + moves[e.key][0], y: view.y + moves[e.key][1] }));
    } else if (e.key === '+' || e.key === '=') zoomAt(zoom * 1.1);
    else if (e.key === '-') zoomAt(zoom / 1.1);
  };

  // The wheel listener must be non-passive to stop the page scrolling while zooming.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const stop = (e) => e.preventDefault();
    el.addEventListener('wheel', stop, { passive: false });
    return () => el.removeEventListener('wheel', stop);
  }, [src]);

  const k = base * zoom;
  const dispW = natural ? natural.w * k : 0;
  const dispH = natural ? natural.h * k : 0;
  const transform = `translate(${view.x}px, ${view.y}px) rotate(${angle}deg) scaleX(${flip ? -1 : 1})`;

  const save = () => {
    if (!natural) return;
    setSaving(true);
    const outW = outputWidth;
    const outH = Math.round(outputWidth / aspect);
    const r = outW / frame.w; // screen px -> output px
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    const png = file.type === 'image/png';
    if (!png) {
      ctx.fillStyle = '#fff'; // JPEG has no transparency; also fills round a zoomed-out photo
      ctx.fillRect(0, 0, outW, outH);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(outW / 2 + view.x * r, outH / 2 + view.y * r);
    ctx.rotate(rad(angle));
    ctx.scale(flip ? -1 : 1, 1);
    ctx.drawImage(imgRef.current, (-dispW * r) / 2, (-dispH * r) / 2, dispW * r, dispH * r);
    const type = png ? 'image/png' : 'image/jpeg';
    canvas.toBlob(
      (blob) => {
        setSaving(false);
        if (!blob) return;
        const name = file.name.replace(/\.[^.]+$/, '') + (png ? '.png' : '.jpg');
        onDone(new File([blob], name, { type }));
      },
      type,
      0.92
    );
  };

  const changed = zoom !== 1 || view.x !== 0 || view.y !== 0 || quarter !== 0 || tilt !== 0 || flip;

  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      size="max-w-2xl"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={!natural || saving}>
            {saving ? 'Saving…' : 'Use this'}
          </button>
        </div>
      }
    >
      <div className="px-4 pb-4 pt-3 sm:px-5">
        <div className="flex justify-center">
          <div
            ref={stageRef}
            role="application"
            aria-label="Crop area. Drag or use the arrow keys to move the photo, pinch, the mouse wheel or plus and minus to zoom."
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onKeyDown={onKeyDown}
            className="ds-focus relative cursor-grab touch-none select-none overflow-hidden rounded-[12px] bg-black active:cursor-grabbing"
            style={{ width: stage.w || '100%', height: stage.h || 260 }}
          >
            {/* white behind the frame = what fills the space when zoomed out */}
            {stage.w > 0 && (
              <div
                className={cn('pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white', round ? 'rounded-full' : 'rounded-[4px]')}
                style={{ width: frame.w, height: frame.h }}
              />
            )}
            {src && (
              <img
                ref={imgRef}
                src={src}
                alt=""
                draggable={false}
                onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={
                  natural
                    ? { width: dispW, height: dispH, marginLeft: -dispW / 2, marginTop: -dispH / 2, transform, willChange: 'transform' }
                    : { opacity: 0 }
                }
              />
            )}
            {/* crop frame: everything outside it is dimmed; a thirds grid shows while moving */}
            {stage.w > 0 && (
              <div
                className={cn(
                  'pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,.6)] ring-2 ring-white/90',
                  round ? 'rounded-full' : 'rounded-[4px]'
                )}
                style={{ width: frame.w, height: frame.h }}
              >
                <div className={cn('absolute inset-0 transition-opacity duration-200', moving || tilt !== 0 ? 'opacity-100' : 'opacity-0')} aria-hidden="true">
                  <div className="absolute inset-y-0 left-1/3 w-px bg-white/50" />
                  <div className="absolute inset-y-0 left-2/3 w-px bg-white/50" />
                  <div className="absolute inset-x-0 top-1/3 h-px bg-white/50" />
                  <div className="absolute inset-x-0 top-2/3 h-px bg-white/50" />
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="muted mt-2 text-center text-[13px]">
          <span className="[@media(pointer:fine)]:hidden">Drag to move · pinch with two fingers to zoom in or out · double-tap to zoom</span>
          <span className="hidden [@media(pointer:fine)]:inline">Drag to move · scroll the mouse wheel to zoom in or out · double-click to zoom</span>
        </p>

        {/* straighten */}
        <div className="mx-auto mt-4 max-w-sm">
          <div className="flex items-center justify-between text-[13px]">
            <label htmlFor="crop-tilt" className="font-medium">Straighten</label>
            <button type="button" className="ds-num muted hover:text-ink" onClick={() => setTilt(0)} title="Back to 0°">
              {tilt > 0 ? '+' : ''}{tilt}°
            </button>
          </div>
          <input
            id="crop-tilt"
            type="range"
            min={-MAX_TILT}
            max={MAX_TILT}
            step="1"
            value={tilt}
            onChange={(e) => setTilt(Number(e.target.value))}
            onPointerDown={() => setMoving(true)}
            onPointerUp={() => setMoving(false)}
            className="mt-1 w-full accent-[var(--ds-brand)]"
          />
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-secondary min-h-10" onClick={() => setQuarter((q) => (q + 1) % 4)}>
            <RotateCw className="h-4 w-4" strokeWidth={1.5} /> Rotate
          </button>
          <button type="button" className="btn-secondary min-h-10" onClick={() => setFlip((f) => !f)} aria-pressed={flip}>
            <FlipHorizontal2 className="h-4 w-4" strokeWidth={1.5} /> Flip
          </button>
          <button type="button" className="btn-secondary min-h-10" onClick={reset} disabled={!changed}>
            <Undo2 className="h-4 w-4" strokeWidth={1.5} /> Reset
          </button>
        </div>
      </div>
    </Modal>
  );
}
