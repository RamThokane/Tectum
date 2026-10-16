import path from 'node:path';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const MB = 1024 * 1024;

export const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
export const NOTES_EXTS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.md'];
export const DOCUMENT_EXTS = ['.pdf', '.jpg', '.jpeg', '.png'];

export const MAX_IMAGE_BYTES = 5 * MB;
export const MAX_NOTES_BYTES = 25 * MB;
export const MAX_DOCUMENT_BYTES = 10 * MB;

const extOf = (file) => path.extname(file.originalname || '').toLowerCase();

const allowByField = {
  images: IMAGE_EXTS,
  profilePicture: IMAGE_EXTS,
  coverPhoto: IMAGE_EXTS,
  notesFile: NOTES_EXTS,
  document: DOCUMENT_EXTS,
  adImage: IMAGE_EXTS,
  questionImage: IMAGE_EXTS,
};

const fileFilter = (_req, file, cb) => {
  const allowed = allowByField[file.fieldname];
  if (!allowed) return cb(ApiError.badRequest(`Unexpected file field: ${file.fieldname}`));
  if (!allowed.includes(extOf(file))) {
    return cb(ApiError.badRequest(`Unsupported file type for ${file.fieldname}. Allowed: ${allowed.join(', ')}`));
  }
  cb(null, true);
};

const base = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_NOTES_BYTES, files: 6 },
});

export const uploadPostFiles = base.fields([
  { name: 'images', maxCount: 4 },
  { name: 'notesFile', maxCount: 1 },
]);
export const uploadProfileImages = base.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'coverPhoto', maxCount: 1 },
]);
export const uploadVerificationDoc = base.single('document');
export const uploadAdImage = base.single('adImage');
export const uploadQuestionImage = base.single('questionImage');

// --- Content sniffing: don't trust the extension/mimetype alone. ---
const startsWith = (buf, bytes, offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

const sniffers = {
  '.jpg': (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  '.jpeg': (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  '.png': (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]),
  '.gif': (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]),
  '.webp': (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8),
  '.pdf': (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]),
  '.docx': (b) => startsWith(b, [0x50, 0x4b]),
  '.pptx': (b) => startsWith(b, [0x50, 0x4b]),
  '.doc': (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0]),
  '.ppt': (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0]),
};

/** Throws if the file's bytes don't match its extension, or it exceeds the size cap. */
export function assertFile(file, { maxBytes, label = 'File' }) {
  if (file.size > maxBytes) {
    throw ApiError.badRequest(`${label} is too large (max ${Math.round(maxBytes / MB)}MB)`);
  }
  const sniff = sniffers[extOf(file)];
  if (sniff && !sniff(file.buffer)) {
    throw ApiError.badRequest(`${label} does not look like a valid ${extOf(file).slice(1).toUpperCase()} file`);
  }
}

export const fileExt = (file) => extOf(file).slice(1);
