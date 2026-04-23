import type { ReactNode } from 'react';

export default function SectionHead({
  title,
  sub,
  right,
  className = '',
}: { title: string; sub?: string; right?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-end justify-between px-5 py-4 border-b border-[var(--color-line)] ${className}`}>
      <div>
        <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--color-ink-3)]">
          {title}
        </div>
        {sub && <div className="text-[13px] text-[var(--color-ink-2)] mt-0.5">{sub}</div>}
      </div>
      {right}
    </div>
  );
}
