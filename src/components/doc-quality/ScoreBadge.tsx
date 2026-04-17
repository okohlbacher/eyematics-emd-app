export interface ScoreBadgeProps {
  score: number;
  bold?: boolean;
}

export function ScoreBadge({ score, bold = false }: ScoreBadgeProps) {
  const rounded = Math.round(score);
  let cls =
    'inline-flex items-center justify-end gap-1 text-xs font-medium px-2 py-0.5 rounded-full ';
  if (score > 80) cls += 'bg-green-100 text-green-700';
  else if (score >= 60) cls += 'bg-amber-100 text-amber-700';
  else cls += 'bg-red-100 text-red-700';

  return (
    <span className={cls} style={{ fontWeight: bold ? 700 : undefined }}>
      {rounded}%
    </span>
  );
}
