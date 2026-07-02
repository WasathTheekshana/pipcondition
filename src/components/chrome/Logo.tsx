export function Logo({ size = 28 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="pipcondition logo">
      <rect width="32" height="32" rx="8" fill="var(--pc-accent)" />
      <g stroke="#ffffff" strokeWidth="1.75" strokeLinecap="round">
        <line x1="8" y1="16" x2="15" y2="16" />
        <line x1="16.5" y1="16" x2="23" y2="9.5" />
        <line x1="16.5" y1="16" x2="23" y2="22.5" />
      </g>
      <circle cx="8" cy="16" r="2.75" fill="#ffffff" />
      <circle cx="16" cy="16" r="2.75" fill="#ffffff" />
      <circle cx="24" cy="9" r="2.75" fill="#ffffff" />
      <circle cx="24" cy="23" r="2.75" fill="#ffffff" />
    </svg>
  );
}
