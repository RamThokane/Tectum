import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ExternalLink, Pencil, Plus, Trash2, GraduationCap, FileDown } from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/ui';
import { Modal, EmptyState } from './ui';
import { PORTFOLIO_SECTIONS, portfolioCount, refHref, refLabel } from '../lib/portfolio';
import { downloadMedicalCv } from '../lib/medicalCv';
import { cn } from '../lib/format';

/** Add / edit one portfolio entry. */
function EntryModal({ section, entry, onSave, onClose, saving }) {
  const [form, setForm] = useState(() => Object.fromEntries(section.fields.map((f) => [f.name, entry?.[f.name] ?? (f.type === 'select' ? f.options[0][0] : '')])));
  const missing = section.fields.find((f) => f.required && (form[f.name] ?? '').trim().length < 2);
  const badLink = section.fields.some((f) => f.name === 'link' && form.link?.trim() && !refHref(form.link));
  return (
    <Modal
      open
      onClose={onClose}
      title={`${entry ? 'Edit' : 'Add'} ${section.short.toLowerCase()}`}
      size="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" disabled={saving || Boolean(missing) || badLink} onClick={() => onSave(form)}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 p-5">
        {section.fields.map((f) => (
          <div key={f.name}>
            <label className="label" htmlFor={`pf-${f.name}`}>
              {f.label} {f.required && <span className="text-danger">*</span>}
            </label>
            {f.type === 'select' ? (
              <select id={`pf-${f.name}`} className="input" value={form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ) : (
              <input
                id={`pf-${f.name}`}
                type={f.type === 'month' ? 'month' : 'text'}
                className="input"
                maxLength={300}
                value={form[f.name]}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                placeholder={f.placeholder}
              />
            )}
            {f.hint && <p className="muted mt-1 text-[12px]">{f.hint}</p>}
            {f.name === 'link' && badLink && <p className="mt-1 text-[12px] font-medium text-danger">Enter a link (https://…), a DOI (10.…) or a PubMed ID.</p>}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** One collapsible section card (e.g. Publications) with its entries. */
function SectionCard({ section, items, isSelf, onAdd, onEdit, onDelete }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="card overflow-clip">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={open}>
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]', section.tint)}>
            <section.icon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">{section.title}</span>
            <span className="muted block text-[12px]">{items.length ? `${items.length} entr${items.length === 1 ? 'y' : 'ies'}` : 'Nothing added yet'}</span>
          </span>
          <ChevronDown className={cn('h-5 w-5 shrink-0 text-ds-fg-3 transition-transform', open && 'rotate-180')} />
        </button>
        {isSelf && (
          <button onClick={onAdd} className="btn-secondary shrink-0 px-2.5 py-1.5 text-[13px]" aria-label={`Add ${section.short.toLowerCase()}`}>
            <Plus className="h-4 w-4" /> Add
          </button>
        )}
      </div>
      {open && items.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {items.map((e, i) => {
            const r = section.read(e);
            const href = refHref(r.link);
            return (
              <li key={e._id ?? i} className="group flex gap-3 px-4 py-3">
                <span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', section.tint)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-snug">{r.title}</p>
                  {r.detail && <p className="text-[13px] text-ds-fg-2">{r.detail}</p>}
                  <p className="muted mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px]">
                    {r.date && <span>{r.date}</span>}
                    {href && (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-link hover:underline">
                        {refLabel(r.link)} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </p>
                </div>
                {isSelf && (
                  <div className="flex shrink-0 items-start gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                    <button onClick={() => onEdit(i)} className="rounded-[6px] p-1.5 text-ds-fg-3 hover:bg-surface-2" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => onDelete(i)} className="rounded-[6px] p-1.5 text-ds-fg-3 hover:bg-surface-2 hover:text-danger" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** "Download Medical CV" button (builds the PDF in the browser). */
export function DownloadCvButton({ user, className }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={cn('btn-secondary', className)}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadMedicalCv(user);
        } catch {
          toast("Couldn't create the PDF. Please try again.", 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <FileDown className="h-4 w-4" /> {busy ? 'Preparing…' : 'Download Medical CV'}
    </button>
  );
}

/**
 * Academic Portfolio tab: publications, electives/rotations, conference presentations and
 * certifications. The owner can add, edit and delete entries; everyone can download the Medical CV.
 */
export default function PortfolioTab({ user }) {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const me = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(null); // { section, index | null }
  const portfolio = user.portfolio ?? {};
  const isSelf = user.isSelf;

  const save = useMutation({
    mutationFn: ({ key, items }) => api.put('/users/me/portfolio', { [key]: items }).then((r) => r.data.portfolio),
    onSuccess: (p) => {
      qc.setQueryData(['user', user._id], (d) => (d ? { ...d, user: { ...d.user, portfolio: p } } : d));
      if (me) setUser({ ...me, portfolio: p });
      setEditing(null);
      toast('Portfolio saved');
    },
    onError: (e) => toast(e.message, 'error'),
  });

  // Visitors only see the sections that have something in them.
  const shown = PORTFOLIO_SECTIONS.filter((s) => isSelf || portfolio[s.key]?.length);
  const clean = (items) => items.map(({ _id, ...rest }) => rest);

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="muted text-[13px]">
          {isSelf ? 'Your publications, rotations, presentations and certifications. Shown on your profile and in your Medical CV.' : `${user.name}'s academic work`}
        </p>
        <DownloadCvButton user={user} className="px-3 py-1.5 text-[13px]" />
      </div>

      {!shown.length || (!isSelf && !portfolioCount(portfolio)) ? (
        <div className="card">
          <EmptyState icon={GraduationCap} title="No academic portfolio yet">
            {user.name} hasn't added publications, rotations, presentations or certifications.
          </EmptyState>
        </div>
      ) : (
        shown.map((s) => {
          const items = portfolio[s.key] ?? [];
          return (
            <SectionCard
              key={s.key}
              section={s}
              items={items}
              isSelf={isSelf}
              onAdd={() => setEditing({ section: s, index: null })}
              onEdit={(i) => setEditing({ section: s, index: i })}
              onDelete={(i) => {
                if (window.confirm('Delete this entry?')) save.mutate({ key: s.key, items: clean(items.filter((_, j) => j !== i)) });
              }}
            />
          );
        })
      )}

      {editing && (
        <EntryModal
          section={editing.section}
          entry={editing.index != null ? portfolio[editing.section.key][editing.index] : null}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSave={(form) => {
            const items = clean(portfolio[editing.section.key] ?? []);
            if (editing.index != null) items[editing.index] = form;
            else items.unshift(form);
            save.mutate({ key: editing.section.key, items });
          }}
        />
      )}
    </div>
  );
}
