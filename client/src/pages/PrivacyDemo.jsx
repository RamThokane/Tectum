import { useState } from 'react';
import { Stethoscope, MessageCircle, RotateCcw, ShieldCheck } from 'lucide-react';
import { PageShell } from '../components/Layout';
import PrivacyWarning, { hasPrivacyIssues } from '../components/PrivacyWarning';

// Made-up drafts that break the privacy rules, so the warning can be seen without posting anything.
const EXAMPLES = [
  {
    id: 'case',
    kind: 'case',
    heading: 'A case that reveals where the patient is',
    title: 'Breathless 70F after hip surgery',
    text: "Day 3 post-op, sudden pleuritic chest pain and SpO2 89% on air. HR 118, calves look normal. Bed 14, St. Mary's. What would you do next?",
  },
  {
    id: 'case-name',
    kind: 'case',
    heading: 'A case with a name and record number',
    title: 'Fever and jaundice for 5 days',
    text: 'Mr. Ramesh Kumar, UHID 20231145, admitted to Lilavati Hospital with fever, jaundice and RUQ pain. Contact his son on 9876543210 for the old reports.',
  },
  { id: 'ask-name', kind: 'comment', heading: "A comment asking for the patient's name", text: "Interesting case! What's the patient's name? I think I saw her in OPD." },
  { id: 'ask-where', kind: 'comment', heading: 'A comment asking where the patient is', text: 'Which hospital is this? Where is the patient admitted now?' },
  { id: 'ask-contact', kind: 'comment', heading: 'A comment asking for contact details', text: 'Can you share her phone number? Please DM the patient details.' },
  { id: 'fine', kind: 'comment', heading: 'A normal comment (no warning)', text: 'Great case. I would get a CTPA and start anticoagulation if there are no contraindications.' },
];

function Example({ ex }) {
  const [title, setTitle] = useState(ex.title ?? '');
  const [text, setText] = useState(ex.text);
  const fields = [...(ex.kind === 'case' ? [{ text: title, onChange: setTitle }] : []), { text, onChange: setText }];
  const blocked = hasPrivacyIssues(fields.map((f) => f.text));
  const reset = () => {
    setTitle(ex.title ?? '');
    setText(ex.text);
  };

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-editorial font-medium flex items-center gap-2 text-[15px]">
          {ex.kind === 'case' ? <Stethoscope className="h-4 w-4 text-danger" /> : <MessageCircle className="h-4 w-4 text-link" />}
          {ex.heading}
        </h2>
        <button className="btn-ghost shrink-0 px-2 py-1 text-[13px]" onClick={reset} aria-label="Reset this example">
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
      </div>
      {ex.kind === 'case' && (
        <input className="input mb-2 font-semibold" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Case title" />
      )}
      <textarea className="input" rows={ex.kind === 'case' ? 4 : 2} value={text} onChange={(e) => setText(e.target.value)} aria-label="Text" />
      <PrivacyWarning fields={fields} className="mt-3" />
      <div className="mt-3 flex items-center justify-end gap-3">
        {!blocked && (
          <span className="flex items-center gap-1 text-[13px] font-semibold text-success">
            <ShieldCheck className="h-4 w-4" /> Passes the privacy check
          </span>
        )}
        <button className="btn-primary px-4 py-1.5" disabled={blocked} onClick={() => {}} title="Demo only - nothing is posted">
          {ex.kind === 'case' ? 'Post' : 'Reply'}
        </button>
      </div>
    </section>
  );
}

/** Demo of the patient-privacy check (route /privacy-demo). Nothing on this page is saved or posted. */
export default function PrivacyDemo() {
  return (
    <PageShell
      cards
      title="Privacy check demo"
      subtitle="Example posts and comments that reveal a patient's identity. Nothing here is posted."
    >
      <div className="space-y-3">
        <p className="card px-4 py-3 text-[13px]">
          This is what members see when a post or comment could identify a patient, or asks for a patient's identity.
          The Post / Reply button stays off until every problem is removed. Press <b>Remove</b>, or edit the text yourself,
          to watch the warning clear. <b>Reset</b> puts the example back.
        </p>
        {EXAMPLES.map((ex) => (
          <Example key={ex.id} ex={ex} />
        ))}
      </div>
    </PageShell>
  );
}
