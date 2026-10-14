// Four-point sparkle star from the Figma design. Decorative only.
export function Sparkle({ className = "", filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg aria-hidden="true" focusable="false" className={className} viewBox="0 0 40 40" fill={filled ? "currentColor" : "none"}>
      <path
        d="M20 2c1.3 11.2 6.8 16.7 18 18-11.2 1.3-16.7 6.8-18 18C18.7 26.8 13.2 21.3 2 20 13.2 18.7 18.7 13.2 20 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
