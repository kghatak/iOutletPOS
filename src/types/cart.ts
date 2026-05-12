import type { Product } from "./product";

/** Decimal places for weight-style quantities (e.g. kg / grams as decimal). */
export const CART_QTY_DECIMAL_PLACES = 3;

export type CartLine = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  /** Max allowed quantity (from outlet stock). Undefined means unlimited. */
  stockCap?: number;
  /**
   * Billed ₹ line total entered via “By ₹” (matches invoice). Cleared when qty is edited elsewhere.
   * When set, totals use this rather than qty × unit price (avoids ₹1999.98 vs ₹2000 from coarse qty rounding).
   */
  pricedTotal?: number;
};

export type CartCustomer = {
  name: string;
  phone: string;
  address: string;
};

export function normalizeCartQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const f =
    Math.round(value * 10 ** CART_QTY_DECIMAL_PLACES) /
    10 ** CART_QTY_DECIMAL_PLACES;
  if (f <= 0) return 0;
  return f;
}

/** Stable string for inputs (trims trailing zeros after normalize). */
export function formatCartQuantityForInput(value: number): string {
  const n = normalizeCartQuantity(value);
  if (n === 0) return "0";
  return String(parseFloat(n.toFixed(CART_QTY_DECIMAL_PLACES)));
}

/** Qty display: up to 3 decimals; “By ₹” lines keep full internal qty but show 3 dp. */
export function formatCartQuantityForLine(line: CartLine): string {
  if (
    line.pricedTotal != null &&
    Number.isFinite(line.quantity) &&
    line.quantity > 0
  ) {
    const n = Math.round(line.quantity * 1000) / 1000;
    return String(parseFloat(n.toFixed(3)));
  }
  return formatCartQuantityForInput(line.quantity);
}

/**
 * Parse user-entered qty (allows decimals). Returns null if not a valid number yet.
 */
export function parseQtyInputString(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/,/g, ".")
    .replace(/[^\d.]/g, "");
  if (cleaned === "" || cleaned === ".") return null;
  const first = cleaned.indexOf(".");
  const normalized =
    first === -1
      ? cleaned
      : `${cleaned.slice(0, first + 1)}${cleaned.slice(first + 1).replace(/\./g, "")}`;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Parse typed rupee line total (e.g. customer wants ₹200 worth). */
export function parseInrAmountString(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/,/g, "")
    .replace(/[^\d.]/g, "");
  if (cleaned === "" || cleaned === ".") return null;
  const first = cleaned.indexOf(".");
  const normalized =
    first === -1
      ? cleaned
      : `${cleaned.slice(0, first + 1)}${cleaned.slice(first + 1).replace(/\./g, "")}`;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function formatInrAmountForInput(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return amount.toFixed(2);
}

export function roundCartLineInr(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Quantity that backs a target line total ₹ (rounded to paise); keeps enough IEEE precision before stock cap.
 */
export function qtyForTargetLineRupee(price: number, targetRupees: number): number {
  const p = Number(price);
  const target = Number(targetRupees);
  if (!(p > 0) || !(target > 0) || !Number.isFinite(target)) return 0;
  const ratio = target / p;
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return Number(ratio.toPrecision(14));
}

export function lineSubtotal(line: CartLine): number {
  const fixed = line.pricedTotal;
  if (fixed != null && Number.isFinite(fixed) && fixed >= 0) return roundCartLineInr(fixed);
  return roundCartLineInr(line.unitPrice * line.quantity);
}

/** One row for POST /sales `items` — quantity is rounded to POS precision; line total matches cart (incl. “By ₹”). */
export type SalePayloadLineItem = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export function cartLinesToSalePayloadItems(lines: CartLine[]): SalePayloadLineItem[] {
  return lines.map((l) => {
    const q = normalizeCartQuantity(l.quantity);
    const lineTotal =
      l.pricedTotal != null && Number.isFinite(l.pricedTotal)
        ? roundCartLineInr(lineSubtotal(l))
        : roundCartLineInr(l.unitPrice * q);
    return {
      productId: l.productId,
      name: l.name,
      unitPrice: l.unitPrice,
      quantity: q,
      lineTotal,
    };
  });
}

export function productToLine(product: Product, quantity = 1): CartLine {
  const cap = product.availableQuantity != null && product.availableQuantity > 0
    ? product.availableQuantity
    : undefined;
  return {
    productId: product.productId ?? product.id,
    name: product.name,
    unitPrice: product.price,
    quantity: normalizeCartQuantity(cap != null ? Math.min(quantity, cap) : quantity),
    stockCap: cap,
  };
}
