export interface Denomination {
  cents: number;
  label: string;
  kind: "note" | "coin";
}

/** Swiss franc denominations, largest first. */
export const DENOMINATIONS: Denomination[] = [
  { cents: 100000, label: "1000.–", kind: "note" },
  { cents: 20000, label: "200.–", kind: "note" },
  { cents: 10000, label: "100.–", kind: "note" },
  { cents: 5000, label: "50.–", kind: "note" },
  { cents: 2000, label: "20.–", kind: "note" },
  { cents: 1000, label: "10.–", kind: "note" },
  { cents: 500, label: "5.–", kind: "coin" },
  { cents: 200, label: "2.–", kind: "coin" },
  { cents: 100, label: "1.–", kind: "coin" },
  { cents: 50, label: "0.50", kind: "coin" },
  { cents: 20, label: "0.20", kind: "coin" },
  { cents: 10, label: "0.10", kind: "coin" },
  { cents: 5, label: "0.05", kind: "coin" },
];

export interface ChangeBreakdownEntry {
  denomination: Denomination;
  count: number;
}

/** Greedily breaks a change amount (in cents) into Swiss denominations. */
export function breakDownChange(changeCents: number): ChangeBreakdownEntry[] {
  let remaining = changeCents;
  const breakdown: ChangeBreakdownEntry[] = [];

  for (const denomination of DENOMINATIONS) {
    const count = Math.floor(remaining / denomination.cents);
    if (count > 0) {
      breakdown.push({ denomination, count });
      remaining -= count * denomination.cents;
    }
  }

  return breakdown;
}

export function formatChf(cents: number): string {
  return (cents / 100).toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
