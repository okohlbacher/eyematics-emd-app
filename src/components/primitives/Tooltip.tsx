import type { ReactElement, ReactNode } from 'react';
import { useId, useState } from 'react';

/**
 * Shared tooltip (Z0-P02, PLAN Q12 a): shown on mouse hover AND on keyboard focus of the
 * wrapped control, dismissible with Escape, and hoverable (WCAG 1.4.13). The wrapped control
 * receives the tooltip id through the render prop so it can reference it via
 * `aria-describedby`. State is local to the component; nothing outlives it.
 */
export default function Tooltip({
  text,
  children,
  align = 'center',
  wrap = false,
}: {
  text: string;
  /** Render prop: receives the tooltip element id for `aria-describedby`. */
  children: (tooltipId: string) => ReactElement;
  align?: 'center' | 'end' | 'start';
  /** Long explanatory texts wrap in a fixed-width box instead of one line (Z0-P03). */
  wrap?: boolean;
}): ReactNode {
  const id = useId();
  const [open, setOpen] = useState(false);
  const position = align === 'end' ? 'right-0' : align === 'start' ? 'left-0' : 'left-1/2 -translate-x-1/2';
  const width = wrap ? 'w-72 whitespace-normal' : 'whitespace-nowrap';
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      {children(id)}
      <span
        id={id}
        role="tooltip"
        className={`${open ? 'block' : 'hidden'} absolute top-full ${position} mt-1 z-50 ${width} rounded-md bg-gray-900 px-2 py-1 text-xs font-normal text-white shadow-lg dark:bg-gray-100 dark:text-gray-900`}
      >
        {text}
      </span>
    </span>
  );
}
