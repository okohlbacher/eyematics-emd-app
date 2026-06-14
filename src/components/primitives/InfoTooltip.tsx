import { Info } from 'lucide-react';

/**
 * Inline definition tooltip — an info icon that reveals an explanatory text on
 * hover (native `title`) and exposes the same text to assistive tech via
 * `aria-label`. Used to disambiguate metric labels (B2: Einwilligungsquote vs
 * Dokumentations-Vollständigkeit). Labelling only — no computation.
 */
export default function InfoTooltip({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      title={text}
      aria-label={text}
      tabIndex={0}
      className={`inline-flex items-center text-[var(--color-ink-3)] cursor-help align-middle focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-teal)] rounded ${className}`}
    >
      <Info className="w-3.5 h-3.5" aria-hidden="true" />
    </span>
  );
}
