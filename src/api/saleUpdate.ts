import { API_BASE_URL } from "../config";
import { getApiHeaders } from "../providers/authProvider";
import type { SaleLineItem, SaleOrderDiscount } from "../types/sale";

/**
 * ## Backend contract (not implemented in this repo — align your API)
 *
 * **Endpoint (proposed):** `PATCH ${API_BASE_URL}/sales/:documentId`
 * - `:documentId` = sale document `_id` from `GET /Sales` (e.g. Mongo id), **not** the human `saleId` string.
 * - If your API uses a different path (e.g. `PUT /Sales` with `saleId` in body), change `patchSale` below.
 *
 * **Headers:** same as other authenticated calls (`Content-Type: application/json`, tenant header, optional `Authorization`).
 *
 * **JSON body** — mirror `POST /sales` (same shape as create) so the server can re-validate stock and totals:
 *
 * ```json
 * {
 *   "outletId": "OUTID113",
 *   "customer": { "name": "...", "phone": "...", "address": "..." },
 *   "items": [
 *     {
 *       "productId": "PROD-00652",
 *       "name": "Bikaner Barfi",
 *       "unitPrice": 560,
 *       "quantity": 1,
 *       "lineTotal": 560
 *     }
 *   ],
 *   "subtotal": 560,
 *   "discount": { "type": "%", "value": 10, "amount": 56 },
 *   "total": 504,
 *   "paymentMode": "Cash"
 * }
 * ```
 *
 * Optional: include `"saleId": "OUTID113-SALE-..."` in the body if your backend keys updates by business id instead of URL param.
 */

export type UpdateSaleRequestBody = {
  outletId: string;
  customer?: { name?: string; phone?: string; address?: string };
  items: Array<{
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discount?: SaleOrderDiscount;
  total: number;
  paymentMode?: string;
  /** Send if the server expects business id in body rather than URL. */
  saleId?: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function applyDiscountToSubtotal(
  subtotal: number,
  discount: SaleOrderDiscount | undefined,
): { discount: SaleOrderDiscount | undefined; total: number } {
  if (discount == null) return { discount: undefined, total: subtotal };
  if (typeof discount === "number") {
    const amt = Math.min(Math.max(0, discount), subtotal);
    return { discount: amt, total: round2(subtotal - amt) };
  }
  const d = discount as { type?: string; value?: number; amount?: number };
  if (d.type === "%" && typeof d.value === "number") {
    const amount = round2(subtotal * (d.value / 100));
    return {
      discount: { type: "%", value: d.value, amount },
      total: round2(subtotal - amount),
    };
  }
  const rupeeOff = Math.min(
    Math.max(0, d.value ?? d.amount ?? 0),
    subtotal,
  );
  return {
    discount: { type: "₹", value: d.value ?? rupeeOff, amount: rupeeOff },
    total: round2(subtotal - rupeeOff),
  };
}

/** Live preview for UI: subtotal from lines, then same discount math as save payload. */
export function previewSaleTotals(
  lines: Array<Pick<SaleLineItem, "unitPrice" | "quantity">>,
  existingDiscount: SaleOrderDiscount | undefined,
): {
  subtotal: number;
  discountAmount: number;
  discount: SaleOrderDiscount | undefined;
  total: number;
} {
  const subtotal = round2(
    lines
      .filter((l) => l.quantity > 0)
      .reduce((s, l) => s + round2(l.unitPrice * l.quantity), 0),
  );
  const { discount, total } = applyDiscountToSubtotal(subtotal, existingDiscount);
  const discountAmount = round2(subtotal - total);
  return { subtotal, discountAmount, discount, total };
}

/** Build request body from edited lines + existing discount rule (recalculates `amount` / `total`). */
export function buildSaleUpdatePayload(
  outletId: string,
  customer: { name?: string; phone?: string; address?: string } | undefined,
  lines: SaleLineItem[],
  existingDiscount: SaleOrderDiscount | undefined,
  paymentMode: string | undefined,
  saleIdForBody?: string,
): UpdateSaleRequestBody {
  const items = lines
    .filter((l) => l.quantity > 0)
    .map((l) => {
      const lineTotal = round2(l.unitPrice * l.quantity);
      return {
        productId: String(l.productId ?? "").trim(),
        name: l.name,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        lineTotal,
      };
    });
  const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
  const { discount, total } = applyDiscountToSubtotal(subtotal, existingDiscount);
  return {
    outletId,
    customer: customer
      ? {
          name: customer.name?.trim() || undefined,
          phone: customer.phone?.trim() || undefined,
          address: customer.address?.trim() || undefined,
        }
      : undefined,
    items,
    subtotal,
    discount,
    total,
    paymentMode: paymentMode?.trim() || undefined,
    ...(saleIdForBody ? { saleId: saleIdForBody } : {}),
  };
}

export async function patchSale(
  documentId: string,
  body: UpdateSaleRequestBody,
): Promise<Response> {
  const url = `${API_BASE_URL}/sales/${encodeURIComponent(documentId)}`;
  return fetch(url, {
    method: "PATCH",
    headers: getApiHeaders(),
    body: JSON.stringify(body),
  });
}
