import { formatEur } from "@/lib/utils/format-currency";

export interface BreakdownItem {
  label: string;
  amount: number;
}

/** Horizontal category breakdown bars (sections 9.4.4 / 9.4.5). */
export function BreakdownBars({
  items,
  color = "var(--accent-primary)",
}: {
  items: BreakdownItem[];
  color?: string;
}) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.amount)));
  if (items.length === 0) {
    return <p className="text-sm text-tertiary">Rien ce mois.</p>;
  }
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-secondary">{item.label}</span>
            <span className="tabnums text-primary">{formatEur(item.amount)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-pressed)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${(Math.abs(item.amount) / max) * 100}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
