import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/ui';
import { Modal } from './ui';
import FileUploadZone from './FileUploadZone';
import { DOCUMENT_ACCEPT } from '../lib/constants';

/** Upload a licence / ID for review. Approval gives the blue tick. */
export default function VerifyModal({ userId, onClose }) {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(null);

  const submit = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('document', files[0]);
      return api
        .post(`/users/${userId}/verify`, fd, { onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)) })
        .then((r) => r.data);
    },
    onSuccess: (d) => {
      setUser({ verificationStatus: d.verificationStatus });
      qc.invalidateQueries({ queryKey: ['user', userId] });
      toast(d.message);
      onClose();
    },
    onError: (e) => toast(e.message, 'error'),
    onSettled: () => setProgress(null),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Get verified"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!files.length || submit.isPending} onClick={() => submit.mutate()}>
            Submit for review
          </button>
        </div>
      }
    >
      <div className="space-y-4 p-5">
        <p className="text-[13px]">
          Upload a document that proves your role: a medical license, nursing registration, hospital ID or student ID.
        </p>
        <ul className="space-y-1 rounded-[12px] bg-surface-2 p-3 text-[13px]">
          <li><strong>Free:</strong> our team reviews it and, once approved, you get the <strong>blue tick</strong>.</li>
        </ul>
        <FileUploadZone files={files} onChange={setFiles} accept={DOCUMENT_ACCEPT} maxSizeMB={10} progress={progress} hint="PDF, JPG or PNG · up to 10 MB" />
        <p className="muted text-[12px]">
          Documents are stored privately. They are never shown on your profile and are only visible to you and Tectum moderators.
        </p>
      </div>
    </Modal>
  );
}
