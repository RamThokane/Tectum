import { cn } from '../lib/format';
import { FEED_SURFACE } from './InfiniteFeed';

const Bar = ({ className }) => <div className={cn('rounded-md bg-surface-3', className)} />;

/** Placeholder post shown while the feed loads (feels faster than a spinner). */
export function PostSkeleton() {
  return (
    <div className="flex animate-pulse gap-3 px-4 py-3" aria-hidden="true">
      <div className="h-11 w-11 shrink-0 rounded-full bg-surface-3" />
      <div className="flex-1">
        <Bar className="mt-1 h-3 w-1/3" />
        <div className="mt-3 space-y-2">
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-11/12" />
          <Bar className="h-3 w-2/3" />
        </div>
        <div className="mt-4 flex gap-10">
          <Bar className="h-4 w-10" />
          <Bar className="h-4 w-10" />
          <Bar className="h-4 w-10" />
        </div>
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 3 }) {
  return (
    <div className={cn(FEED_SURFACE, 'animate-pulse')} role="status" aria-label="Loading posts">
      {Array.from({ length: count }, (_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}
