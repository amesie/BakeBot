// How each flavour looks on the menu. Visual only: names and prices come from
// the products table (get_menu), which is the source of truth.
import type { CakePopVariant } from "@/components/kd/cake-pop";

type Visual = {
  variant: CakePopVariant;
  tint: "orange" | "blue" | "green" | "yellow";
  /** Show the "Made with real Belgian chocolate!" badge. */
  belgian?: boolean;
};

const visuals: Record<string, Visual> = {
  "belgian chocolate": { variant: "dark", tint: "orange", belgian: true },
  "cookies and cream": { variant: "cookies", tint: "blue" },
  "top deck": { variant: "swirl", tint: "green", belgian: true },
  funfetti: { variant: "sprinkles", tint: "yellow" },
};

const fallbacks: Visual[] = Object.values(visuals);

/** Look up a flavour's illustration; unknown flavours cycle through the set. */
export function visualFor(flavour: string, index: number): Visual {
  return visuals[flavour.trim().toLowerCase()] ?? fallbacks[index % fallbacks.length];
}
