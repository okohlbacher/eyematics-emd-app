import type { ReactNode } from 'react';

type Tone = 'neutral' | 'teal' | 'sage' | 'coral' | 'amber' | 'indigo' | 'outline';

const tones: Record<Tone, string> = {
  neutral: 'bg-[var(--color-surface-2)] text-[var(--color-ink-2)] border-[var(--color-line)]',
  teal:    'bg-[var(--color-teal-soft)] text-[var(--color-teal-ink)] border-transparent',
  sage:    'bg-[var(--color-sage-soft)] text-[var(--color-sage-ink)] border-transparent',
  coral:   'bg-[var(--color-coral-soft)] text-[var(--color-coral-ink)] border-transparent',
  amber:   'bg-[var(--color-amber-soft)] text-[var(--color-amber-ink)] border-transparent',
  indigo:  'bg-[var(--color-indigo-soft)] text-[var(--color-indigo-ink)] border-transparent',
  outline: 'bg-transparent text-[var(--color-ink-2)] border-[var(--color-line-2)]',
};

export default function Badge({
  tone = 'neutral',
  children,
  className = '',
}: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium tracking-[0.01em] ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
