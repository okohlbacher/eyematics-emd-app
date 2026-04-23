// Lightweight SVG sparkline — no recharts dependency, no layout shift.
export default function Sparkline({
  data,
  color = 'var(--color-teal)',
  width = 90,
  height = 24,
  fill = true,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const rng = max - min || 1;
  const pts = data.map((v, i) => [
    (i * width) / (data.length - 1),
    height - ((v - min) / rng) * (height - 4) - 2,
  ] as const);
  const d = 'M ' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ');
  const area = d + ` L ${width} ${height} L 0 ${height} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg width={width} height={height} className="block overflow-visible">
      {fill && <path d={area} fill={color} opacity="0.12" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  );
}
