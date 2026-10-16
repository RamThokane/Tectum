import { useState } from 'react';
import { ROLES, SPECIALIST_TITLES, PG_DEGREES } from '../lib/constants';

const OTHER = '__other';

/**
 * The Role dropdown, with specialist doctors built in: "Doctor (MBBS)" keeps the Doctor badge,
 * while picking e.g. Cardiologist, Radiologist or MD General Medicine sets role = doctor and shows
 * that title as the badge. "Other specialty…" lets doctors type their own.
 * Calls onChange({ role, designation }).
 */
export default function RoleSelect({ id, role, designation = '', onChange, className = 'input' }) {
  const listed = SPECIALIST_TITLES.includes(designation) || PG_DEGREES.includes(designation);
  // Only doctors carry a designation; typing an unlisted one keeps the "Other specialty" box open.
  const [typing, setTyping] = useState(role === 'doctor' && Boolean(designation) && !listed);
  const value = role === 'doctor' ? (typing ? OTHER : designation ? `doctor:${designation}` : 'doctor') : role || '';

  const pick = (v) => {
    if (v === OTHER) {
      setTyping(true);
      onChange({ role: 'doctor', designation: listed ? '' : designation });
      return;
    }
    setTyping(false);
    if (v.startsWith('doctor:')) onChange({ role: 'doctor', designation: v.slice(7) });
    else onChange({ role: v, designation: '' });
  };

  const others = ROLES.filter((r) => r.value !== 'doctor');
  return (
    <div className="space-y-2">
      <select id={id} className={className} value={value} onChange={(e) => pick(e.target.value)}>
        {!role && <option value="" disabled>Choose your role</option>}
        <option value="student">{ROLES.find((r) => r.value === 'student').label}</option>
        <option value="doctor">Doctor (MBBS)</option>
        <optgroup label="Specialist doctors">
          {SPECIALIST_TITLES.map((t) => <option key={t} value={`doctor:${t}`}>{t}</option>)}
        </optgroup>
        <optgroup label="PG degree">
          {PG_DEGREES.map((t) => <option key={t} value={`doctor:${t}`}>{t}</option>)}
        </optgroup>
        <option value={OTHER}>Other specialty (type your own)…</option>
        <optgroup label="Other roles">
          {others.filter((r) => r.value !== 'student').map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </optgroup>
      </select>
      {typing && (
        <input
          className="input"
          maxLength={40}
          autoFocus
          value={designation}
          onChange={(e) => onChange({ role: 'doctor', designation: e.target.value })}
          placeholder="Your specialty, e.g. Sports Medicine Physician"
          aria-label="Your specialty"
        />
      )}
    </div>
  );
}
