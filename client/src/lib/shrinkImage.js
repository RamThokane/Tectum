// Phone photos are often 5-15 MB, and iPhones save HEIC. Before upload we redraw such photos
// as a JPEG no larger than MAX_SIDE px, so they fit the server's limits and allowed types.

const MAX_SIDE = 2048;
const QUALITY = 0.85;
const SMALL_ENOUGH = 1.5 * 1024 * 1024;

const extOf = (name) => (name.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase();
const isGif = (file) => file.type === 'image/gif' || extOf(file.name) === '.gif';
export const looksLikeImage = (file) => file.type.startsWith('image/') || ['.heic', '.heif'].includes(extOf(file.name));

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode failed'));
    };
    img.src = url;
  });
}

/**
 * Returns a smaller JPEG copy of a photo when it is big or of a type the server won't take
 * (`allowedExts`); small allowed files and GIFs (animation) come back unchanged.
 * Throws if the browser can't read the photo (e.g. HEIC outside Safari).
 */
export async function shrinkImage(file, allowedExts) {
  if (isGif(file)) return file;
  if (file.size <= SMALL_ENOUGH && allowedExts.includes(extOf(file.name))) return file;

  const { img, url } = await loadImage(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // JPEG has no transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob) throw new Error('encode failed');
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
}
