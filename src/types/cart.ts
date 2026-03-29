import type { Product } from "./product";

/** Decimal places for weight-style quantities (e.g. grams). */
export const CART_QTY_DECIMAL_PLACES = 4;

export type CartLine = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
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

export function lineSubtotal(line: CartLine): number {
  return line.unitPrice * line.quantity;
}

export function productToLine(product: Product, quantity = 1): CartLine {
  return {
    productId: product.productId ?? product.id,
    name: product.name,
    unitPrice: product.price,
    quantity: normalizeCartQuantity(quantity),
  };
}
