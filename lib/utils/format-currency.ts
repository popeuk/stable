/**
 * French money & percent formatting (section 7.2).
 *   - non-breaking space as thousands separator and before € / %
 *   - comma as decimal separator
 *   - 0 decimals for amounts > 100 €, 2 decimals otherwise
 */

const NBSP = " ";

export function formatEur(value: number, opts?: { sign?: boolean }): string {
  const decimals = Math.abs(value) > 100 ? 0 : 2;
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  const withSign =
    opts?.sign && value > 0 ? `+${formatted}` : formatted;
  return `${withSign}${NBSP}€`;
}

/** Same as formatEur but always forces the +/- sign (for deltas). */
export function formatEurDelta(value: number): string {
  return formatEur(value, { sign: true });
}

export function formatPct(value: number, decimals = 0): string {
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${formatted}${NBSP}%`;
}

/** Compact form for the time ribbon labels, e.g. "1,2 k€". */
export function formatEurCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const k = value / 1000;
    return `${new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 1,
    }).format(k)}${NBSP}k€`;
  }
  return formatEur(value);
}
