import { createContext, forwardRef, useContext, useId, useState } from 'react';
import { Search, X, Eye, EyeOff, ChevronDown, Check, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/format';

// Fields share their id / error state through context, so <Field label=… error=…><Input/></Field>
// wires up htmlFor, aria-describedby and aria-invalid without any props on the input.
const FieldCtx = createContext(null);

/** Label above, the control, then a hint or an inline error. */
export function Field({ label, hint, error, optional, children, className }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <FieldCtx.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cn('space-y-1.5', className)}>
        {label && (
          <label htmlFor={id} className="block text-meta font-medium text-ds-fg">
            {label} {optional && <span className="font-normal text-ds-fg-3">(optional)</span>}
          </label>
        )}
        {children}
        {error ? (
          <p id={`${id}-err`} className="flex items-center gap-1.5 text-meta text-ds-danger" role="alert">
            <AlertCircle className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" /> {error}
          </p>
        ) : (
          hint && <p id={`${id}-hint`} className="text-meta text-ds-fg-3">{hint}</p>
        )}
      </div>
    </FieldCtx.Provider>
  );
}

const useField = (props) => {
  const f = useContext(FieldCtx);
  return {
    id: props.id ?? f?.id,
    'aria-describedby': props['aria-describedby'] ?? f?.describedBy,
    'aria-invalid': props['aria-invalid'] ?? (f?.invalid || undefined),
  };
};

// Hairline border, 6px corners, blue focus ring; danger border when invalid.
const control =
  'w-full rounded-ds-sm border border-ds-line-strong bg-ds-surface px-3 text-body text-ds-fg placeholder:text-ds-fg-4 ' +
  'transition-[border-color,box-shadow] duration-150 outline-none ' +
  'focus:border-ds-brand-text focus:shadow-[0_0_0_3px_var(--ds-focus)] ' +
  'aria-[invalid=true]:border-ds-danger disabled:cursor-not-allowed disabled:bg-ds-surface-2 disabled:text-ds-fg-3';

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} {...props} {...useField(props)} className={cn(control, 'h-10', className)} />;
});

export const Textarea = forwardRef(function Textarea({ className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} {...props} {...useField(props)} className={cn(control, 'py-2.5 leading-relaxed', className)} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} {...props} {...useField(props)} className={cn(control, 'h-10 appearance-none pr-9', className)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ds-fg-3" aria-hidden="true" />
    </div>
  );
});

export const DateInput = forwardRef(function DateInput({ className, ...props }, ref) {
  return <input ref={ref} type="date" {...props} {...useField(props)} className={cn(control, 'h-10 ds-num', className)} />;
});

/** Password with a show / hide eye. */
export const PasswordField = forwardRef(function PasswordField({ className, ...props }, ref) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input ref={ref} {...props} {...useField(props)} type={shown ? 'text' : 'password'} className={cn(control, 'h-10 pr-10', className)} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="ds-focus absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-ds-sm text-ds-fg-3 hover:text-ds-fg"
        aria-label={shown ? 'Hide password' : 'Show password'}
      >
        {shown ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
      </button>
    </div>
  );
});

/** Search box: pill-shaped, magnifier on the left, clear button when there's text. */
export const SearchInput = forwardRef(function SearchInput({ value, onChange, onClear, className, placeholder = 'Search', ...props }, ref) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ds-fg-3" strokeWidth={1.75} aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        role="searchbox"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...props}
        {...useField(props)}
        className={cn(control, 'h-10 rounded-full border-transparent bg-ds-surface-2 pl-10 pr-9 [&::-webkit-search-cancel-button]:hidden')}
      />
      {value && (
        <button type="button" onClick={onClear} className="ds-focus absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-ds-fg-3 hover:bg-ds-surface-3 hover:text-ds-fg" aria-label="Clear search">
          <X className="size-3.5" strokeWidth={2} />
        </button>
      )}
    </div>
  );
});

/** Checkbox with its label to the right (the whole row is clickable). */
export function Checkbox({ label, description, checked, onChange, disabled, className }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-50', className)}>
      <span className="relative mt-0.5 flex size-4.5 shrink-0">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange?.(e.target.checked)} disabled={disabled} className="peer ds-focus size-full cursor-pointer appearance-none rounded-ds-sm border border-ds-line-strong bg-ds-surface transition checked:border-ds-brand checked:bg-ds-brand" />
        <Check className="pointer-events-none absolute inset-0 m-auto size-3 text-ds-on-brand opacity-0 peer-checked:opacity-100" strokeWidth={3} aria-hidden="true" />
      </span>
      <span>
        <span className="block text-body text-ds-fg">{label}</span>
        {description && <span className="block text-meta text-ds-fg-3">{description}</span>}
      </span>
    </label>
  );
}

/** One option of a radio group. Give every option in a group the same `name`. */
export function Radio({ label, description, name, value, checked, onChange, disabled }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-50')}>
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange?.(value)}
        disabled={disabled}
        className="ds-focus mt-0.5 size-4.5 shrink-0 cursor-pointer appearance-none rounded-full border border-ds-line-strong bg-ds-surface transition checked:border-[5px] checked:border-ds-brand"
      />
      <span>
        <span className="block text-body text-ds-fg">{label}</span>
        {description && <span className="block text-meta text-ds-fg-3">{description}</span>}
      </span>
    </label>
  );
}

/** On / off switch (a real switch role, so screen readers say "on" / "off"). */
export function Switch({ label, description, checked, onChange, disabled }) {
  const id = useId();
  return (
    <div className={cn('flex items-start justify-between gap-4', disabled && 'opacity-50')}>
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-body text-ds-fg">{label}</span>
        {description && <span className="block text-meta text-ds-fg-3">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn('ds-focus relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-ds-brand' : 'bg-ds-surface-3')}
      >
        <span className={cn('absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-ds-raised transition-transform duration-200', checked && 'translate-x-4')} />
      </button>
    </div>
  );
}
