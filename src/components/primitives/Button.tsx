import type { ButtonHTMLAttributes,ReactNode } from 'react';

type Variant = 'primary' | 'accent' | 'ghost' | 'soft' | 'link';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-[var(--color-ink)] text-white border-[var(--color-ink)] hover:opacity-90',
  accent:  'bg-[var(--color-teal)] text-white border-[var(--color-teal)] hover:opacity-90',
  ghost:   'bg-[var(--color-surface)] text-[var(--color-ink)] border-[var(--color-line-2)] hover:bg-[var(--color-surface-2)]',
  soft:    'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-transparent hover:bg-[var(--color-line)]',
  link:    'bg-transparent text-[var(--color-teal)] border-transparent hover:underline',
};

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs rounded-md gap-1',
  md: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  lg: 'px-4 py-2.5 text-sm rounded-lg gap-2',
};

export default function Button({
  variant = 'ghost',
  size = 'md',
  icon,
  children,
  className = '',
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center font-medium border cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}
