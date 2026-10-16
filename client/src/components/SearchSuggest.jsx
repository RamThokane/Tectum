import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Hash, FileText, Stethoscope, X } from 'lucide-react';
import { api } from '../api/client';
import Avatar from './Avatar';
import { Tick } from './VerificationBadge';
import { WARDS } from '../lib/specialties';
import { prettyTag, userTitle } from '../lib/constants';
import { cn, pluralize, truncateWords } from '../lib/format';

/** `value` after it has stopped changing for `ms`. */
function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wards whose name has a word starting with the text, or whose initials match ("im" = Internal Medicine). */
function matchWards(q) {
  const t = q.toLowerCase().replace(/^#/, '');
  if (!t) return [];
  const starts = new RegExp(`(^|[\\s&-])${escapeRegex(t)}`, 'i');
  const letters = t.replace(/[^a-z]/g, '');
  return WARDS.filter((w) => {
    if (starts.test(w.label) || starts.test(w.short ?? '')) return true;
    const ini = w.label.split(/\s+/).filter((x) => /^[a-z]/i.test(x)).map((x) => x[0].toLowerCase()).join('');
    return letters.length >= 2 && ini.startsWith(letters);
  }).slice(0, 3);
}

/** The typed letters in bold wherever a word starts with them. */
function Highlight({ text, q }) {
  const t = q.replace(/^[#@]/, '').trim();
  if (!t) return text;
  const parts = text.split(new RegExp(`((?:^|(?<=[\\s\\-(/&]))${escapeRegex(t)})`, 'i'));
  return parts.map((p, i) => (i % 2 ? <b key={i} className="font-semibold">{p}</b> : p));
}

/**
 * Search box with type-ahead: from the first letter it suggests people (by any part of the name or
 * their initials), Wards, #tags and posts. Arrow keys + Enter pick a suggestion; Enter on its own runs
 * the full search.
 */
export default function SearchSuggest({ value, onChange, onSubmit, placeholder = 'Search', inputClassName, autoFocus }) {
  const navigate = useNavigate();
  const listId = useId();
  const boxRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const q = value.trim();
  const debounced = useDebounced(q, 120);

  const { data, isFetching } = useQuery({
    queryKey: ['search-suggest', debounced.toLowerCase()],
    queryFn: () => api.get('/search/suggest', { params: { q: debounced } }).then((r) => r.data),
    enabled: debounced.replace(/^[#@]/, '').length >= 1,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  // One flat list so the arrow keys can walk through every section.
  const items = useMemo(() => {
    if (!q.replace(/^[#@]/, '')) return [];
    const out = [];
    for (const u of data?.users ?? []) out.push({ kind: 'user', key: `u${u._id}`, user: u, to: `/profile/${u._id}` });
    for (const w of matchWards(q)) out.push({ kind: 'ward', key: `w${w.slug}`, ward: w, to: `/ward/${w.slug}` });
    const wardSlugs = new Set(matchWards(q).map((w) => w.slug));
    for (const t of data?.tags ?? []) {
      if (!wardSlugs.has(t.tag)) out.push({ kind: 'tag', key: `t${t.tag}`, tag: t, to: `/discover?q=${encodeURIComponent('#' + t.tag)}` });
    }
    for (const p of data?.posts ?? []) out.push({ kind: 'post', key: `p${p._id}`, post: p, to: p.type === 'case_study' ? `/cases/${p._id}` : `/post/${p._id}` });
    out.push({ kind: 'all', key: 'all' });
    return out;
  }, [data, q]);

  useEffect(() => setActive(-1), [debounced]);

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const pick = (item) => {
    setOpen(false);
    if (!item || item.kind === 'all') return onSubmit();
    navigate(item.to);
  };

  const onKeyDown = (e) => {
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter' && open && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    }
  };

  const show = open && items.length > 0;
  let section = null;
  const header = (kind) => {
    if (kind === section) return null;
    section = kind;
    const label = { user: 'People', ward: 'Wards', tag: 'Tags', post: 'Posts' }[kind];
    return label ? <li role="presentation" className="muted px-4 pb-1 pt-2.5 text-[12px] font-semibold uppercase tracking-wide">{label}</li> : <li role="presentation" className="my-1 border-t border-line" />;
  };

  return (
    <div ref={boxRef} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(false);
          onSubmit();
        }}
        role="search"
      >
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ds-fg-3" />
          <input
            type="text"
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label={placeholder}
            role="combobox"
            aria-expanded={show}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            className={cn('w-full rounded-full border border-line py-2.5 pl-11 pr-10 text-[15px] text-ink outline-none placeholder:text-ds-fg-3 focus:border-link focus:ring-1 focus:ring-link', inputClassName)}
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ds-fg-3 hover:bg-surface-2"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      </form>

      {show && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-1.5 max-h-[70dvh] overflow-y-auto rounded-[12px] border border-line bg-surface py-1 shadow-ds-floating"
        >
          {items.map((item, i) => {
            const rowCls = cn('flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left', active === i ? 'bg-surface-2' : 'hover:bg-surface-2');
            const rowProps = {
              id: `${listId}-${i}`,
              role: 'option',
              'aria-selected': active === i,
              onMouseEnter: () => setActive(i),
              onMouseDown: (e) => e.preventDefault(), // keep focus in the box
              onClick: () => pick(item),
              className: rowCls,
            };
            return (
              <FragmentWithHeader key={item.key} header={header(item.kind)}>
                {item.kind === 'user' ? (
                  <li {...rowProps}>
                    <Avatar user={item.user} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-[15px] font-semibold leading-5">
                        <span className="truncate"><Highlight text={item.user.name} q={q} /></span> <Tick user={item.user} />
                      </span>
                      <span className="muted block truncate text-[13px] leading-5">
                        {userTitle(item.user)}
                        {item.user.institution && ` · ${item.user.institution}`}
                      </span>
                    </span>
                  </li>
                ) : item.kind === 'ward' ? (
                  <li {...rowProps}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2">
                      <item.ward.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold"><Highlight text={item.ward.label} q={q} /></span>
                  </li>
                ) : item.kind === 'tag' ? (
                  <li {...rowProps}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2">
                      <Hash className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold capitalize">{prettyTag(item.tag.tag)}</span>
                    <span className="muted shrink-0 text-[13px]">{pluralize(item.tag.count, 'post')}</span>
                  </li>
                ) : item.kind === 'post' ? (
                  <li {...rowProps}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2">
                      {item.post.type === 'case_study' ? <Stethoscope className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </span>
                    <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-5"><Highlight text={truncateWords(item.post.text, 120)} q={q} /></span>
                  </li>
                ) : (
                  <li {...rowProps}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2">
                      <Search className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px]">
                      Search for "<b>{q}</b>"
                    </span>
                    {isFetching && <span className="h-3 w-3 animate-spin rounded-full border-2 border-line-strong border-t-transparent" aria-hidden="true" />}
                  </li>
                )}
              </FragmentWithHeader>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FragmentWithHeader({ header, children }) {
  return (
    <>
      {header}
      {children}
    </>
  );
}
