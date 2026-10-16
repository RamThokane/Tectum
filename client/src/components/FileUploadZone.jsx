import { useEffect, useMemo, useRef, useState } from 'react';
import { UploadCloud, X, FileText, ImageIcon, Crop as CropIcon } from 'lucide-react';
import ImageCropper from './ImageCropper';
import { cn, formatBytes } from '../lib/format';
import { shrinkImage, looksLikeImage } from '../lib/shrinkImage';

const extOf = (name) => (name.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase();

/**
 * Drag-and-drop file picker with client-side type/size checks, image previews
 * and an optional upload progress bar (0-100, or null when idle).
 * `crop` ({ aspect, round, title, outputWidth }) opens a cropper for a chosen photo first
 * (profile photo, cover); "Adjust crop" re-opens it on the original.
 */
export default function FileUploadZone({
  files,
  onChange,
  accept,
  multiple = false,
  maxFiles = 1,
  maxSizeMB = 10,
  progress = null,
  label = 'Drag & drop a file here',
  hint,
  compact = false,
  crop = null,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [cropping, setCropping] = useState(null); // the photo being cropped
  const [original, setOriginal] = useState(null); // uncropped photo, for "Adjust crop"
  const allowed = useMemo(() => accept.split(',').map((s) => s.trim().toLowerCase()), [accept]);

  // Preview URLs are created and revoked by the same effect, so a re-run (e.g. React StrictMode's
  // mount/unmount/mount) never leaves the images pointing at already-revoked blobs.
  const [previews, setPreviews] = useState([]);
  useEffect(() => {
    const urls = files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null));
    setPreviews(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [files]);

  const takesImages = allowed.includes('.jpg');
  const [preparing, setPreparing] = useState(false);

  const addFiles = async (list) => {
    setError('');
    let incoming = Array.from(list);
    // Shrink big phone photos (and turn HEIC into JPEG) before the type/size checks below.
    if (takesImages && incoming.some(looksLikeImage)) {
      setPreparing(true);
      incoming = await Promise.all(
        incoming.map((f) =>
          looksLikeImage(f)
            ? shrinkImage(f, allowed).catch(() => {
                setError(`${f.name}: this photo couldn't be read. Try a JPG or PNG, or take a screenshot of it and upload that.`);
                return null;
              })
            : f
        )
      );
      incoming = incoming.filter(Boolean);
      setPreparing(false);
    }
    const ok = [];
    for (const f of incoming) {
      if (!allowed.includes(extOf(f.name))) {
        setError(`${f.name}: unsupported type. Allowed: ${accept.replaceAll(',', ', ')}`);
        continue;
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        setError(`${f.name} is larger than ${maxSizeMB} MB`);
        continue;
      }
      ok.push(f);
    }
    if (crop && ok[0]?.type.startsWith('image/')) {
      setOriginal(ok[0]);
      setCropping(ok[0]);
      return;
    }
    const next = multiple ? [...files, ...ok].slice(0, maxFiles) : ok.slice(0, 1);
    if (multiple && files.length + ok.length > maxFiles) setError(`You can attach up to ${maxFiles} files`);
    if (ok.length) onChange(next);
  };

  const uploading = progress !== null;
  const full = multiple ? files.length >= maxFiles : files.length === 1;

  return (
    <div>
      {!full && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !uploading && !preparing && inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!uploading) addFiles(e.dataTransfer.files);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-[12px] border border-dashed text-center transition',
            compact ? 'px-4 py-4' : 'px-6 py-8',
            dragging
              ? 'border-link bg-ds-brand-soft'
              : 'border-line-strong hover:border-link hover:bg-surface-2'
          )}
        >
          <UploadCloud className={cn('text-link', compact ? 'h-5 w-5' : 'mb-2 h-8 w-8')} />
          <p className="text-[15px] font-medium">
            {label} <span className="text-link">or browse</span>
          </p>
          {preparing ? <p className="muted mt-1 text-[12px]" aria-live="polite">Preparing photo…</p> : hint && <p className="muted mt-1 text-[12px]">{hint}</p>}
          <input
            ref={inputRef}
            type="file"
            hidden
            // image/* makes phones offer the photo gallery and camera, not only a file list
            accept={takesImages ? `${accept},image/*` : accept}
            multiple={multiple}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}

      {files.length > 0 && (
        <ul className={cn('mt-3 gap-2', crop ? 'flex flex-col' : previews.some(Boolean) ? 'grid grid-cols-2 sm:grid-cols-4' : 'flex flex-col')}>
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className={cn('relative', crop && 'flex items-center gap-3')}>
              {previews[i] && crop ? (
                <>
                  <img
                    src={previews[i]}
                    alt="Cropped preview"
                    className={cn('object-cover ring-1 ring-line', crop.round ? 'h-20 w-20 rounded-full' : 'w-full max-w-sm rounded-[12px]')}
                    style={crop.round ? undefined : { aspectRatio: crop.aspect }}
                  />
                  {original && !uploading && (
                    <button type="button" className="btn-secondary shrink-0" onClick={() => setCropping(original)}>
                      <CropIcon className="h-4 w-4" /> Adjust crop
                    </button>
                  )}
                </>
              ) : previews[i] ? (
                <img src={previews[i]} alt={f.name} className="aspect-square w-full rounded-[12px] object-cover" />
              ) : (
                <div className="flex items-center gap-3 rounded-[12px] border border-line bg-surface-2/50 px-3 py-2.5">
                  {f.type.startsWith('image/') ? <ImageIcon className="h-5 w-5 text-link" /> : <FileText className="h-5 w-5 text-link" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{f.name}</p>
                    <p className="muted ds-num text-[12px]">{formatBytes(f.size)}</p>
                  </div>
                </div>
              )}
              {!uploading && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(files.filter((_, j) => j !== i));
                    if (crop) setOriginal(null);
                  }}
                  className={cn('rounded-full bg-black/60 p-1 text-white hover:bg-black/80', crop ? 'absolute left-1 top-1' : 'absolute right-1.5 top-1.5')}
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {cropping && (
        <ImageCropper
          file={cropping}
          aspect={crop.aspect}
          round={crop.round}
          title={crop.title}
          outputWidth={crop.outputWidth}
          onCancel={() => setCropping(null)}
          onDone={(f) => {
            setCropping(null);
            onChange([f]);
          }}
        />
      )}

      {uploading && (
        <div className="mt-3" aria-live="polite">
          <div className="ds-num mb-1 flex justify-between text-[12px] font-medium">
            <span>{progress < 100 ? 'Uploading…' : 'Processing & running safety checks…'}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-ds-brand transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
