import { Trophy } from 'lucide-react';
import Avatar from '../Avatar';
import { cn } from '../../lib/format';
import { fmtDuration } from '../../lib/quiz';
import { useAuthStore } from '../../store/auth';

/** Ranked participants (best attempt each; disqualified attempts aren't ranked). */
export default function Leaderboard({ rows }) {
  const me = useAuthStore((s) => s.user?._id);
  if (!rows?.length) return <p className="muted px-4 py-6 text-center text-[14px]">No one is ranked yet.</p>;
  return (
    <ol className="divide-y divide-line" aria-label="Leaderboard">
      {rows.map((r) => {
        const mine = r.user?._id === me;
        return (
          <li key={`${r.rank}-${r.user?._id}`} className={cn('flex items-center gap-3 px-4 py-2.5', mine && 'bg-ds-brand-soft')}>
            <span className={cn('ds-num flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold', r.rank <= 3 ? 'bg-ds-accent-soft text-ds-accent-text' : 'text-ds-fg-3')}>
              {r.rank <= 3 ? <Trophy className="h-4 w-4" aria-label={`Rank ${r.rank}`} /> : r.rank}
            </span>
            {r.user ? <Avatar user={r.user} size="sm" /> : null}
            <span className="min-w-0 flex-1 truncate text-[15px] text-ink">
              {r.user?.name ?? 'Former member'}
              {mine && <span className="muted"> (you)</span>}
            </span>
            <span className="muted hidden text-[12px] sm:inline">{fmtDuration(r.timeTakenSec)}</span>
            <span className="ds-num w-16 text-right font-semibold text-ink">{r.score}</span>
          </li>
        );
      })}
    </ol>
  );
}
