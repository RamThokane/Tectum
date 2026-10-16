import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';
import { stripImageMetadata } from './imageMetadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PUBLIC_DIR = path.resolve(__dirname, '../../uploads');
export const PRIVATE_DIR = path.resolve(__dirname, '../../private_uploads');

if (env.cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
  console.log('[storage] Cloudinary enabled');
} else if (env.isProd) {
  // Hosts like Render wipe the local disk on every restart/deploy, so uploads would vanish.
  console.error('[storage] WARNING: Cloudinary is not configured. Uploaded photos and files are saved on this server\'s disk and will be LOST on restart. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.');
} else {
  console.warn('[storage] Cloudinary not configured - using local disk (development only)');
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const extOf = (file) => path.extname(file.originalname || '').toLowerCase();

const cloudinaryUpload = (buffer, options) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(options, (err, result) => (err ? reject(err) : resolve(result)))
      .end(buffer);
  });

/**
 * Stores an uploaded file (multer memory file) and returns { url, ref }.
 *  - public files: `url` is directly viewable
 *  - private files (verification documents): `url` is an opaque reference such as
 *    "cloudinary:authenticated:image:tectum/verification/abc" or "local:abc.pdf".
 *    It is never a public URL; use getPrivateAccess() to obtain a short-lived way in.
 */
export async function saveFile(file, { folder, isPrivate = false }) {
  const ext = extOf(file);
  const isImage = IMAGE_EXTS.has(ext);
  const id = randomUUID();
  // Every stored image loses its hidden metadata first (GPS location, camera, date, names).
  if (isImage) file = { ...file, buffer: stripImageMetadata(file.buffer, ext) };

  try {
    if (env.cloudinaryEnabled) {
      const resource_type = isImage ? 'image' : 'raw';
      const options = {
        folder: `tectum/${folder}`,
        resource_type,
        // Raw resources keep their extension inside the public_id.
        public_id: isImage ? id : `${id}${ext}`,
        ...(isPrivate ? { type: 'authenticated' } : {}),
        // Incoming transformation: the stored original is at most 2000px on its longest side
        // (phone photos arrive at 4000px+; nothing on the site is ever shown larger).
        ...(isImage && !isPrivate ? { transformation: [{ width: 2000, height: 2000, crop: 'limit' }] } : {}),
      };
      const result = await cloudinaryUpload(file.buffer, options);
      if (isPrivate) {
        return { url: `cloudinary:authenticated:${resource_type}:${result.public_id}` };
      }
      return { url: result.secure_url };
    }

    const dir = path.join(isPrivate ? PRIVATE_DIR : PUBLIC_DIR, folder);
    fs.mkdirSync(dir, { recursive: true });
    const name = `${id}${ext}`;
    await fs.promises.writeFile(path.join(dir, name), file.buffer);
    return { url: isPrivate ? `local:${folder}/${name}` : `/uploads/${folder}/${name}` };
  } catch (err) {
    console.error('[storage] upload failed', err);
    throw ApiError.badRequest('File upload failed, please try again');
  }
}

/**
 * Permanently removes a stored file given the `url` saveFile returned (public or private).
 * Best-effort: a file that is already gone, or an unrecognised URL, is silently skipped.
 */
export async function deleteFile(url) {
  if (!url) return;
  try {
    if (url.startsWith('cloudinary:')) {
      const [, type, resourceType, ...rest] = url.split(':');
      await cloudinary.uploader.destroy(rest.join(':'), { resource_type: resourceType, type, invalidate: true });
      return;
    }
    // https://res.cloudinary.com/<cloud>/<image|raw>/upload/v123/<public_id>[.ext]
    const m = /res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/upload\/(?:v\d+\/)?(.+)$/.exec(url);
    if (m) {
      const [, resourceType, rest] = m;
      const publicId = resourceType === 'raw' ? rest : rest.replace(/\.[^./]+$/, '');
      await cloudinary.uploader.destroy(decodeURIComponent(publicId), { resource_type: resourceType, invalidate: true });
      return;
    }
    const local = url.startsWith('local:')
      ? path.resolve(PRIVATE_DIR, url.slice('local:'.length))
      : url.startsWith('/uploads/')
        ? path.resolve(PUBLIC_DIR, url.slice('/uploads/'.length))
        : null;
    if (local && (local.startsWith(PRIVATE_DIR + path.sep) || local.startsWith(PUBLIC_DIR + path.sep))) {
      await fs.promises.rm(local, { force: true });
    }
  } catch (err) {
    console.error('[storage] delete failed', err.message);
  }
}

/** Resolves a private reference to either a signed redirect URL or a local file path. */
export function getPrivateAccess(ref) {
  if (!ref) return null;
  if (ref.startsWith('cloudinary:')) {
    const [, type, resourceType, ...rest] = ref.split(':');
    const publicId = rest.join(':');
    const url = cloudinary.url(publicId, {
      resource_type: resourceType,
      type,
      sign_url: true,
      secure: true,
    });
    return { redirectUrl: url };
  }
  if (ref.startsWith('local:')) {
    const rel = ref.slice('local:'.length);
    const full = path.resolve(PRIVATE_DIR, rel);
    // Guard against path traversal from a tampered reference.
    if (!full.startsWith(PRIVATE_DIR + path.sep)) return null;
    return { filePath: full };
  }
  return null;
}
