export interface ScoreBadgeProps {
  score: number;
  bold?: boolean;
}

export function ScoreBadge({ score, bold = false }: ScoreBadgeProps) {
  const rounded = Math.round(score);
  let cls =
    'inline-flex items-center justify-end gap-1 text-xs font-medium px-2 py-0.5 rounded-full ';
  // M12 (v1.18): dark-mode swatches — translucent tinted fill + lighter text so
  // the status colour reads on a dark table row instead of glowing pale.
  if (score > 80) cls += 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  else if (score >= 60) cls += 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  else cls += 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';

  return (
    <span className={cls} style={{ fontWeight: bold ? 700 : undefined }}>
      {rounded}%
    </span>
  );
}
