export type SplitPaymentChannel = "Cash" | "Card" | "UPI";

export type SalePaymentSplit = {
  mode: SplitPaymentChannel;
  amount: number;
};

export type PosPaymentMode = "Cash" | "Card" | "UPI" | "Due" | "Split";

export const SPLIT_PAYMENT_CHANNELS: SplitPaymentChannel[] = ["Cash", "Card", "UPI"];

export type SplitPaymentAmounts = Record<SplitPaymentChannel, string>;

export const EMPTY_SPLIT_AMOUNTS: SplitPaymentAmounts = {
  Cash: "",
  Card: "",
  UPI: "",
};

export function parseSplitAmount(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function buildPaymentsFromSplitAmounts(
  amounts: SplitPaymentAmounts,
): SalePaymentSplit[] {
  const out: SalePaymentSplit[] = [];
  for (const mode of SPLIT_PAYMENT_CHANNELS) {
    const amt = Math.round(parseSplitAmount(amounts[mode]) * 100) / 100;
    if (amt > 0) out.push({ mode, amount: amt });
  }
  return out;
}

export function splitPaymentsTotal(payments: SalePaymentSplit[]): number {
  return Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
}

/** Split needs ≥2 modes with amount > 0 and sum matching bill total. */
export function isSplitPaymentBalanced(
  payments: SalePaymentSplit[],
  targetTotal: number,
): boolean {
  if (payments.length < 2) return false;
  return Math.abs(splitPaymentsTotal(payments) - targetTotal) < 0.01;
}

export function isSplitPaymentMode(mode: string | undefined): boolean {
  return (mode ?? "").trim().toLowerCase() === "split";
}

export function parseSalePayments(raw: unknown): SalePaymentSplit[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SalePaymentSplit[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const modeRaw = String(o.mode ?? o.Mode ?? "").trim();
    const mode =
      modeRaw === "Cash" || modeRaw === "Card" || modeRaw === "UPI"
        ? modeRaw
        : null;
    const amount = Number(o.amount ?? o.Amount);
    if (mode && Number.isFinite(amount) && amount > 0) {
      out.push({ mode, amount: Math.round(amount * 100) / 100 });
    }
  }
  return out.length > 0 ? out : undefined;
}

export function formatPaymentDisplayLabel(
  mode: string | undefined,
  payments?: SalePaymentSplit[],
): string {
  if (isSplitPaymentMode(mode) && payments?.length) {
    return `Split: ${payments.map((p) => `${p.mode} ₹${p.amount.toFixed(2)}`).join(", ")}`;
  }
  const m = mode?.trim();
  return m || "—";
}
