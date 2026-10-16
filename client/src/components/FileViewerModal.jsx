import { Download, ExternalLink } from 'lucide-react';
import { assetUrl } from '../api/client';
import { Modal } from './ui';

/** Only PDFs render inside the app; Word/PowerPoint files still have to be downloaded. */
export const canPreviewInApp = (fileType) => String(fileType || '').toLowerCase() === 'pdf';

/** Reads a notes file inside Tectum, without leaving the page or downloading it first. */
export default function FileViewerModal({ file, open, onClose }) {
  if (!file) return null;
  const url = assetUrl(file.url);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={file.fileName || 'Study notes'}
      size="max-w-5xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <a href={url} target="_blank" rel="noreferrer" className="btn-secondary">
            <ExternalLink className="h-4 w-4" /> Open in new tab
          </a>
          <a href={url} download={file.fileName} className="btn-primary">
            <Download className="h-4 w-4" /> Download
          </a>
        </div>
      }
    >
      <iframe
        src={`${url}#view=FitH`}
        title={file.fileName || 'Study notes'}
        className="h-[78dvh] w-full bg-surface-2"
      />
    </Modal>
  );
}
