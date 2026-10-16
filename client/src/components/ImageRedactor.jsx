import { useEffect, useRef, useState } from 'react';
import { Undo2, Check, EyeOff } from 'lucide-react';
import { Modal } from './ui';
import { pluralize } from '../lib/format';

/** Heavy pixelation + blur of one rectangle, drawn onto the canvas (can't be undone once saved). */
function redact(ctx, r) {
  const { x, y, w, h } = r;
  if (w < 2 || h < 2) return;
  const block = Math.max(10, Math.round(Math.max(w, h) / 12));
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(w / block));
  small.height = Math.max(1, Math.round(h / block));
  const s = small.getContext('2d');
  s.drawImage(ctx.canvas, x, y, w, h, 0, 0, small.width, small.height);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, small.width, small.height, x, y, w, h);
  // soften the blocks so no edges of the original show through
  ctx.filter = `blur(${Math.round(block / 2)}px)`;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(ctx.canvas, x, y, w, h, x, y, w, h);
  ctx.restore();
}

/**
 * "Blur faces or details": drag boxes over faces, names, wristbands or ID numbers and they are
 * pixelated and blurred for good. Saving re-encodes the picture in the browser (which also drops
 * its hidden metadata) and hands back a new File.
 */
export default function ImageRedactor({ file, onDone, onClose }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [rects, setRects] = useState([]);
  const [draft, setDraft] = useState(null);
  const [ready, setReady] = useState(false);
  const start = useRef(null);

  // Load the picture once.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Redraw: original, every blurred box, then the box being dragged (outline only).
  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!ready || !img || !canvas) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    rects.forEach((r) => redact(ctx, r));
    if (draft) {
      ctx.save();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = Math.max(2, canvas.width / 300);
      ctx.setLineDash([10, 6]);
      ctx.strokeRect(draft.x, draft.y, draft.w, draft.h);
      ctx.restore();
    }
  }, [ready, rects, draft]);

  // Pointer position in image pixels (the canvas is shown scaled down).
  const toImage = (e) => {
    const c = canvasRef.current;
    const b = c.getBoundingClientRect();
    return { x: ((e.clientX - b.left) / b.width) * c.width, y: ((e.clientY - b.top) / b.height) * c.height };
  };
  const box = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = toImage(e);
    setDraft({ ...start.current, w: 0, h: 0 });
  };
  const onMove = (e) => start.current && setDraft(box(start.current, toImage(e)));
  const onUp = (e) => {
    if (!start.current) return;
    const r = box(start.current, toImage(e));
    start.current = null;
    setDraft(null);
    if (r.w > 8 && r.h > 8) setRects((rs) => [...rs, r]);
  };

  const save = () => {
    const canvas = canvasRef.current;
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    canvas.toBlob(
      (blob) => {
        if (!blob) return onClose();
        const name = file.name.replace(/\.[^.]+$/, '') + (type === 'image/png' ? '.png' : '.jpg');
        onDone(new File([blob], name, { type }));
      },
      type,
      0.92
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Blur faces or details"
      size="max-w-3xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button className="btn-ghost" onClick={() => setRects((r) => r.slice(0, -1))} disabled={!rects.length}>
            <Undo2 className="h-4 w-4" /> Undo
          </button>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={!rects.length}>
              <Check className="h-4 w-4" /> Apply {rects.length ? `(${rects.length})` : ''}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3 p-4">
        <p className="muted flex items-start gap-2 text-[13px]">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-link" />
          Drag a box over each face, name, wristband, hospital number or date. The area is blurred permanently when you apply.
        </p>
        <div className="flex justify-center rounded-[12px] bg-black/80 p-2">
          {!ready && <div className="h-64 w-full animate-pulse rounded-[6px] bg-white/10" />}
          <canvas
            ref={canvasRef}
            className="max-h-[60dvh] max-w-full touch-none cursor-crosshair select-none"
            style={{ display: ready ? 'block' : 'none' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            role="img"
            aria-label={`Image being edited, ${pluralize(rects.length, 'area')} blurred`}
          />
        </div>
      </div>
    </Modal>
  );
}
