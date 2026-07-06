/** Money helpers. All amounts are stored as integer PAISE (₹1 = 100 paise). */

export const toPaise = (rupees: number): number => Math.round(rupees * 100);
export const toRupees = (paise: number): number => paise / 100;

/** "₹48,720" — whole rupees, Indian grouping. */
export function formatINR(paise: number, opts?: { paise?: boolean; sign?: boolean }): string {
  const rupees = paise / 100;
  const showPaise = opts?.paise ?? false;
  const abs = Math.abs(rupees);
  const body = abs.toLocaleString("en-IN", {
    minimumFractionDigits: showPaise ? 2 : 0,
    maximumFractionDigits: showPaise ? 2 : 0,
  });
  const sign = rupees < 0 ? "-" : opts?.sign ? "+" : "";
  return `${sign}₹${body}`;
}

/** Compact form for large numbers: ₹48.7K, ₹1.2L. */
export function formatINRCompact(paise: number): string {
  const rupees = paise / 100;
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

/** Round an expense up to the nearest ₹`step` and return the roundup delta in paise. */
export function roundupPaise(amountPaise: number, stepRupees = 100): number {
  const stepPaise = stepRupees * 100;
  if (stepPaise <= 0) return 0;
  const remainder = amountPaise % stepPaise;
  return remainder === 0 ? 0 : stepPaise - remainder;
}
