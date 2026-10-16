import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { cldUrl } from '../lib/cldUrl';
import { useScrollLock } from './ui';

const MIN = 1;
const MAX = 6;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Full-screen image viewer for case images (ECGs, X-rays, skin photos).
 * Zoom: buttons, mouse wheel, double-click / double-tap, or pinch with two fingers.
 * Pan: drag while zoomed. Arrow keys / buttons move between images; Escape closes.
 */
export default function Lightbox({ images, index: start = 0, onClose }) {
  const [index, setIndex] = useState(start);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const lastTap = useRef(0);
  const closeRef = useRef(null);
  const n = images.length;
  useScrollLock(true);

  const reset = useCallback(() => setView({ scale: 1, x: 0, y: 0 }), []);
  const go = useCallback((d) => {
    setIndex((i) => (i + d + n) % n);
    reset();
  }, [n, reset]);
  const zoomBy = (f) => setView((v) => {
    const scale = clamp(v.scale * f, MIN, MAX);
    return scale === 1 ? { scale: 1, x: 0, y: 0 } : { ...v, scale };
  });

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && n > 1) go(1);
      else if (e.key === 'ArrowLeft' && n > 1) go(-1);
      else if (e.key === '+' || e.key === '=') zoomBy(1.4);
      else if (e.key === '-') zoomBy(1 / 1.4);
    };
    document.addEventListener('keydown', onKey);
    const lastFocus = document.activeElement;
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      lastFocus?.focus?.();
    };
  }, [go, n, onClose]);

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
    }
    // double tap / double click toggles zoom
    const now = Date.now();
    if (pointers.current.size === 1 && now - lastTap.current < 280) {
      setView((v) => (v.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 }));
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };
  const onPointerMove = (e) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setView((v) => ({ ...v, scale: clamp((pinch.current.scale * dist) / pinch.current.dist, MIN, MAX) }));
    } else if (view.scale > 1) {
      setView((v) => ({ ...v, x: v.x + (e.clientX - prev.x), y: v.y + (e.clientY - prev.y) }));
    }
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (view.scale <= 1) setView({ scale: 1, x: 0, y: 0 });
  };
  const onWheel = (e) => zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);

  const btn = 'flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20';
  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Image viewer">
      <div className="flex items-center justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <p className="text-[13px] font-semibold ds-num">{n > 1 ? `${index + 1} / ${n}` : ''}</p>
        <div className="flex items-center gap-2">
          <button className={btn} onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out"><ZoomOut className="h-5 w-5" /></button>
          <button className={btn} onClick={() => zoomBy(1.4)} aria-label="Zoom in"><ZoomIn className="h-5 w-5" /></button>
          <button className={btn} onClick={reset} aria-label="Reset zoom"><RotateCcw className="h-5 w-5" /></button>
          <button ref={closeRef} className={btn} onClick={onClose} aria-label="Close image viewer"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div
        className="relative flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        style={{ cursor: view.scale > 1 ? 'grab' : 'zoom-in' }}
      >
        <img
          src={cldUrl(images[index], { w: 2000, crop: 'limit', dpr: 1 })}
          alt={`Case image ${index + 1} of ${n}`}
          draggable={false}
          className="max-h-full max-w-full object-contain"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transition: pointers.current.size ? 'none' : 'transform 150ms ease-out' }}
        />
        {n > 1 && (
          <>
            <button className={`${btn} absolute left-3 top-1/2 -translate-y-1/2`} onClick={() => go(-1)} aria-label="Previous image"><ChevronLeft className="h-6 w-6" /></button>
            <button className={`${btn} absolute right-3 top-1/2 -translate-y-1/2`} onClick={() => go(1)} aria-label="Next image"><ChevronRight className="h-6 w-6" /></button>
          </>
        )}
      </div>
      <p className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[12px] text-white/60">Pinch, scroll or double-tap to zoom · drag to move</p>
    </div>,
    document.body
  );
}
