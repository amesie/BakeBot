// Cake pop illustrations from the Figma design (inline SVG: no image requests,
// which keeps the order journey under the 500 KB page-weight NFR).
import { Sparkle } from "./sparkle";

export type CakePopVariant = "dark" | "cookies" | "swirl" | "sprinkles";

export function CakePop({
  variant,
  label,
  className = "",
}: {
  variant: CakePopVariant;
  /** Accessible name; omit for decorative use. */
  label?: string;
  className?: string;
}) {
  const dark = variant === "dark" || variant === "swirl";
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg {...a11y} focusable="false" className={className} viewBox="0 0 150 210">
      <path d="M71 111 61 198" fill="none" stroke="#3B2A20" strokeLinecap="round" strokeWidth="8" />
      <path d="M75 109 65 198" fill="none" stroke="#FFF8EE" strokeLinecap="round" strokeWidth="4" />
      <path
        d="M28 65c0-29 19-49 47-49s48 20 48 49c0 24-12 48-48 48S28 89 28 65Z"
        fill={dark ? "#7B4A2E" : "#FFF8EE"}
        stroke="#3B2A20"
        strokeWidth="3"
      />
      {variant === "dark" && (
        <>
          <path d="M34 55c15 13 27-10 42 3s28-11 41 2" fill="none" stroke="#3B2A20" strokeLinecap="round" strokeWidth="6" />
          <path d="M43 82c15 12 26-9 41 3 10 8 19 1 28-5" fill="none" stroke="#A66B46" strokeLinecap="round" strokeWidth="4" />
        </>
      )}
      {variant === "cookies" && (
        <>
          <circle cx="48" cy="51" r="6" fill="#3B2A20" />
          <path d="m85 34 13 8-7 12-14-7Z" fill="#3B2A20" />
          <circle cx="105" cy="75" r="7" fill="#3B2A20" />
          <path d="m43 80 14-5 6 13-15 4Z" fill="#3B2A20" />
          <circle cx="78" cy="69" r="4" fill="#7B4A2E" />
        </>
      )}
      {variant === "swirl" && (
        <>
          <path
            d="M32 50c17-8 23 13 39 4s23-9 46 2M30 78c18-10 27 12 44 3s27-9 45 0"
            fill="none"
            stroke="#FFF8EE"
            strokeLinecap="round"
            strokeWidth="6"
          />
          <path d="M47 33c12 8 20 5 30-2" fill="none" stroke="#FFF8EE" strokeLinecap="round" strokeWidth="5" />
        </>
      )}
      {variant === "sprinkles" && (
        <>
          <path d="m47 43 9-4" stroke="#E76E50" strokeLinecap="round" strokeWidth="5" />
          <path d="m76 32 1 10" stroke="#E6AF2E" strokeLinecap="round" strokeWidth="5" />
          <path d="m100 48-8 6" stroke="#7EAA72" strokeLinecap="round" strokeWidth="5" />
          <path d="m49 72 8 7" stroke="#6B83C4" strokeLinecap="round" strokeWidth="5" />
          <path d="m83 69 9 1" stroke="#D46A91" strokeLinecap="round" strokeWidth="5" />
          <path d="m103 83-7 7" stroke="#E76E50" strokeLinecap="round" strokeWidth="5" />
        </>
      )}
    </svg>
  );
}

export function HeroPops({ label }: { label: string }) {
  return (
    <div className="hero-art" role="img" aria-label={label}>
      <span className="art-blob" />
      <CakePop variant="cookies" className="pop pop-one" />
      <CakePop variant="dark" className="pop pop-two" />
      <CakePop variant="sprinkles" className="pop pop-three" />
      <Sparkle className="hero-sparkle sparkle-one" />
      <Sparkle className="hero-sparkle sparkle-two" filled />
      <span className="tiny-star" aria-hidden="true">✦</span>
    </div>
  );
}
