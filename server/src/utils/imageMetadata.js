/**
 * Removes hidden metadata from uploaded images before they are stored: EXIF (GPS location,
 * camera, date/time, sometimes the owner's name), XMP, IPTC and comments. Pixels are untouched.
 *  JPEG: drops APP1 (EXIF/XMP), APP13 (IPTC) and COM segments (keeps JFIF and colour profile).
 *  PNG:  drops tEXt, zTXt, iTXt, eXIf and tIME chunks.
 *  WebP: drops the EXIF and XMP chunks and clears their flags.
 * Anything it can't parse is returned unchanged (the upload still works).
 */

function stripJpeg(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const out = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return buf; // not a marker: bail out safely
    const marker = buf[i + 1];
    if (marker === 0xda) {
      out.push(buf.subarray(i)); // start of scan: the rest is image data
      return Buffer.concat(out);
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) return buf;
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) out.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return buf;
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function stripPng(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIG)) return buf;
  const out = [PNG_SIG];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    const end = i + 12 + len;
    if (end > buf.length) return buf;
    if (!PNG_DROP.has(type)) out.push(buf.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(out);
}

function stripWebp(buf) {
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return buf;
  const chunks = [];
  let i = 12;
  while (i + 8 <= buf.length) {
    const type = buf.toString('latin1', i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    const end = i + 8 + size + (size % 2);
    if (end > buf.length + 1) return buf;
    if (type !== 'EXIF' && type !== 'XMP ') chunks.push(Buffer.from(buf.subarray(i, Math.min(end, buf.length))));
    i = end;
  }
  // Clear the EXIF (0x08) and XMP (0x04) flags in the extended header, if there is one.
  const vp8x = chunks.find((c) => c.toString('latin1', 0, 4) === 'VP8X');
  if (vp8x) vp8x[8] &= ~0x0c;
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, body]);
}

/** `ext` is the file extension with its dot, e.g. ".jpg". */
export function stripImageMetadata(buffer, ext) {
  try {
    if (ext === '.jpg' || ext === '.jpeg') return stripJpeg(buffer);
    if (ext === '.png') return stripPng(buffer);
    if (ext === '.webp') return stripWebp(buffer);
  } catch {
    /* fall through: keep the original */
  }
  return buffer;
}
