import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import Avatar from './Avatar';
import { Tick } from './VerificationBadge';
import { userTitle } from '../lib/constants';
import { cn } from '../lib/format';

// "@" + up to 30 name characters right before the caret (at the start or after whitespace).
const TRIGGER = /(^|\s)@([^\s@[\]()]{1,30})$/;

/**
 * A textarea with @mention suggestions. Typing "@pri" lists matching members (only those who
 * allow mentions); choosing one inserts "@[Priya Sharma](id)", which renders as a profile link.
 */
export default function MentionTextarea({ value, onChange, className, onKeyDown, ...props }) {
  const ref = useRef(null);
  const [query, setQuery] = useState(null); // { q, start } while the picker is open
  const [active, setActive] = useState(0);

  const { data: users = [] } = useQuery({
    queryKey: ['mentionable', query?.q],
    queryFn: () => api.get('/users/mentionable', { params: { q: query.q } }).then((r) => r.data.users),
    enabled: Boolean(query?.q),
    staleTime: 30_000,
  });
  const open = Boolean(query) && users.length > 0;

  useEffect(() => setActive(0), [query?.q]);

  const detect = (text, caret) => {
    const m = TRIGGER.exec(text.slice(0, caret));
    setQuery(m ? { q: m[2], start: caret - m[2].length - 1 } : null);
  };

  const pick = (user) => {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const token = `@[${user.name}](${user._id}) `;
    const next = value.slice(0, query.start) + token + value.slice(caret);
    onChange({ target: { value: next } });
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = query.start + token.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e) => {
    if (open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => (a + 1) % users.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => (a - 1 + users.length) % users.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pick(users[active]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setQuery(null);
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        onClick={(e) => detect(e.target.value, e.target.selectionStart)}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        className={className}
        aria-autocomplete="list"
        {...props}
      />
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-[12px] bg-white py-1 shadow-ds-floating ring-1 ring-line"
        >
          <li className="muted px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide">Mention someone</li>
          {users.map((u, i) => (
            <li key={u._id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(u)}
                onMouseEnter={() => setActive(i)}
                className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left', i === active && 'bg-ds-brand-soft')}
              >
                <Avatar user={u} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate text-[13px] font-semibold">{u.name} <Tick user={u} className="h-3.5 w-3.5" /></span>
                  <span className="muted block truncate text-[12px]">{userTitle(u)}{u.institution && ` · ${u.institution}`}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
