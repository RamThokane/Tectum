import { cldUrl } from '../lib/cldUrl';
import { cn, initials } from '../lib/format';

// Initials sit on one quiet neutral fill (no pastel rainbow); photos get the same fill while loading.
const tint = 'bg-ds-surface-3 text-ds-fg-2';

const SIZES = { xs: 'h-7 w-7 text-[12px]', sm: 'h-9 w-9 text-[12px]', md: 'h-11 w-11 text-[13px]', lg: 'h-16 w-16 text-[17px]', xl: 'h-24 w-24 text-[28px] sm:h-28 sm:w-28' };
// Largest CSS pixel size of each (xl grows to 112px on wider screens).
const PX = { xs: 28, sm: 36, md: 44, lg: 64, xl: 112 };

export default function Avatar({ user, size = 'md', className }) {
  const cls = cn('shrink-0 rounded-full object-cover', SIZES[size], className);
  if (user?.profilePicture) {
    const px = PX[size] ?? 44;
    // A face-centred square at 2x the shown size (a 36px avatar used to download the 4032px original).
    return (
      <img
        src={cldUrl(user.profilePicture, { w: px, h: px })}
        alt=""
        width={px}
        height={px}
        className={cn(cls, tint)}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <div className={cn(cls, tint, 'flex items-center justify-center font-medium')} aria-hidden="true">
      {initials(user?.name)}
    </div>
  );
}
