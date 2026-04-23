import type { HTMLAttributes,ReactNode } from 'react';

export default function Tile({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[14px] ${className}`}
    >
      {children}
    </div>
  );
}
