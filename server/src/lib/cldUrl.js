import { assetUrl } from '../api/client';

// Cloudinary delivery URLs look like https://res.cloudinary.com/<cloud>/image/upload/<version>/<id>.jpg.
// Putting a transformation right after "/upload/" makes Cloudinary resize, compress and convert
// (f_auto: WebP/AVIF where supported, q_auto: smart quality) at the edge.
const UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/;

/**
 * A sized, compressed image URL. `w` / `h` are CSS pixels; the image is fetched at 2x for sharp
 * screens. `crop`: 'fill' (cover the box; `gravity` 'face' keeps faces in view, 'auto' the subject)
 * or 'limit' (shrink only, keep shape).
 * Non-Cloudinary paths (local uploads in development) are returned unchanged.
 */
export function cldUrl(src, { w, h, crop = 'fill', gravity = 'face', dpr = 2 } = {}) {
  const url = assetUrl(src);
  const m = url.match(UPLOAD);
  if (!m) return url;
  const parts = ['f_auto', 'q_auto'];
  if (crop === 'fill') parts.push('c_fill', `g_${gravity}`);
  else parts.push('c_limit');
  if (w) parts.push(`w_${Math.round(w * dpr)}`);
  if (h) parts.push(`h_${Math.round(h * dpr)}`);
  return `${m[1]}${parts.join(',')}/${m[2]}`;
}

/** srcset for a responsive image (shrink-only, keeps its shape): "…w_400… 400w, …w_800… 800w, …". */
export function cldSrcSet(src, widths = [400, 800, 1200]) {
  const url = assetUrl(src);
  if (!UPLOAD.test(url)) return undefined;
  return widths.map((w) => `${cldUrl(src, { w, crop: 'limit', dpr: 1 })} ${w}w`).join(', ');
}
