import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Hash } from 'lucide-react';
import { api } from '../api/client';
import SpecialtyTagChip from './SpecialtyTagChip';
import { suggestTags, tagLabel } from '../lib/medicalTags';
import { cn, pluralize } from '../lib/format';

const normalize = (t) => t.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-').slice(0, 30);

/** The typed text, but only after typing pauses (so we don't ask the server on every key). */
function useDebounced(value, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Tag entry with autocomplete: as you type, matching medical tags drop down (from Tectum's
 * built-in library plus tags people already use, with how many posts have each). Pick one with
 * a tap, or the arrow keys + Enter. Anything else you type still becomes a tag on Enter or comma.
 */
export default function TagInput({ value, onChange, max = 8, placeholder = 'Add a tag and press Enter' }) {
  const [draft, setDraft] = useState('');
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const q = normalize(draft);
  const debounced = useDebounced(q);

  const { data: used } = useQuery({
    queryKey: ['tag-suggest', debounced],
    queryFn: () => api.get('/posts/tags', { params: { q: debounced } }).then((r) => r.data.tags),
    enabled: debounced.length > 0,
    staleTime: 60_000,
  });
  const suggestions = focused && q ? suggestTags(q, { exclude: value, extra: used ?? [], limit: 8 }) : [];
  const full = value.length >= max;

  const add = (raw) => {
    const t = normalize(raw);
    if (!t || value.includes(t) || value.length >= max) return;
    onChange([...value, t]);
  };
  const pick = (t) => {
    add(t);
    setDraft('');
    setActive(0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === ',' || (e.key === 'Tab' && suggestions.length && draft)) {
      if (!draft.trim()) return;
      e.preventDefault();
      // Enter/Tab takes the highlighted suggestion; a comma always keeps exactly what was typed.
      pick(e.key !== ',' && suggestions[active] ? suggestions[active].tag : draft);
    } else if (e.key === 'Escape') {
      setDraft('');
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      <div className="input flex flex-wrap items-center gap-1.5 py-2">
        {value.map((t) => (
          <SpecialtyTagChip key={t} tag={t} onRemove={(x) => onChange(value.filter((v) => v !== x))} />
        ))}
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (draft) add(draft);
            setDraft('');
          }}
          placeholder={full ? `Max ${max} tags` : placeholder}
          disabled={full}
          className="min-w-[8rem] flex-1 bg-transparent text-[13px] outline-none"
          aria-label="Tags"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls="tag-suggestions"
          aria-autocomplete="list"
          autoComplete="off"
        />
      </div>

      {suggestions.length > 0 && (
        <ul id="tag-suggestions" role="listbox" className="ds-glass-strong ds-rise mt-1 overflow-hidden rounded-[12px] p-1">
          {suggestions.map((s, i) => (
            <li key={s.tag} role="option" aria-selected={i === active}>
              <button
                type="button"
                // mousedown (not click) so the input doesn't lose focus and close the list first
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s.tag);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn('flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left text-[13px] transition', i === active && 'bg-surface-2')}
              >
                <Hash className="h-4 w-4 shrink-0 text-link" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{tagLabel(s.tag)}</span>
                  <span className="muted ml-1.5 text-[12px]">#{s.tag}</span>
                </span>
                {s.posts > 0 && (
                  <span className="muted shrink-0 text-[12px]">
                    {pluralize(s.posts, 'post')}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {focused && q && !suggestions.length && !full && (
        <p className="muted mt-1 px-1 text-[12px]">Press Enter to add #{q} as a new tag.</p>
      )}
    </div>
  );
}
