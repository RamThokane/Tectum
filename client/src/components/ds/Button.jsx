import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/format';

const VARIANTS = {
  // solid blue: the one main action on a screen
  primary: 'bg-ds-brand text-ds-on-brand hover:bg-ds-brand-hover shadow-ds-raised',
  // glass: secondary actions (it floats a little above the page)
  secondary: 'ds-glass text-ds-fg hover:brightness-[1.03]',
  // quiet: inline / toolbar actions
  ghost: 'text-ds-fg-2 hover:bg-ds-surface-2 hover:text-ds-fg',
  // destructive: delete, block
  danger: 'bg-ds-danger-soft text-ds-danger hover:bg-ds-danger hover:text-white',
  // outline on flat content (cards), where glass would look out of place
  outline: 'border border-ds-line-strong bg-ds-surface text-ds-fg hover:bg-ds-surface-2',
};
const SIZES = {
  sm: 'h-8 gap-1.5 px-3 text-meta',
  md: 'h-10 gap-2 px-4 text-body',
  lg: 'h-12 gap-2 px-5 text-lead',
};
const ICON_SIZES = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };

/**
 * Button. variant: primary | secondary | ghost | danger | outline · size: sm | md | lg.
 * `loading` shows a spinner and blocks clicks; `icon` / `iconRight` take a Lucide component.
 */
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, iconRight: IconRight, className, children, disabled, type = 'button', ...props },
  ref
) {
  const iconCls = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'ds-press ds-focus inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-full font-ui font-medium',
        'disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className={cn(iconCls, 'animate-spin')} aria-hidden="true" /> : Icon && <Icon className={iconCls} strokeWidth={1.75} aria-hidden="true" />}
      {children}
      {IconRight && !loading && <IconRight className={iconCls} strokeWidth={1.75} aria-hidden="true" />}
    </button>
  );
});

/** Icon-only button. `label` is required: it becomes the accessible name and the tooltip. */
export const IconButton = forwardRef(function IconButton({ icon: Icon, label, variant = 'ghost', size = 'md', className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'ds-press ds-focus inline-flex shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant],
        ICON_SIZES[size],
        className
      )}
      {...props}
    >
      <Icon className={size === 'lg' ? 'size-5' : 'size-4.5'} strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
});
