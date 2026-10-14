/** Rand amount for display: R10, R12.50. */
export function formatRand(amount: number | string): string {
  const value = Number(amount);
  return Number.isInteger(value) ? `R${value}` : `R${value.toFixed(2)}`;
}
