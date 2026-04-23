// Abstract iris mark — replaces the raster logo in the sidebar header.
// Uses theme tokens so it recolors with accent tweaks.
export default function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-label="EyeMatics">
      <defs>
        <clipPath id="bm-eye"><path d="M2 20 Q20 6 38 20 Q20 34 2 20 Z" /></clipPath>
      </defs>
      <path
        d="M2 20 Q20 6 38 20 Q20 34 2 20 Z"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="1.8"
      />
      <g clipPath="url(#bm-eye)">
        <circle cx="20" cy="20" r="9" fill="var(--color-teal)" />
        <path d="M20 11 L20 29 M11 20 L29 20" stroke="var(--color-sage)" strokeWidth="1.2" opacity="0.9" />
        <circle cx="20" cy="20" r="3.2" fill="var(--color-ink)" />
        <circle cx="18.8" cy="18.8" r="0.9" fill="white" />
      </g>
    </svg>
  );
}
