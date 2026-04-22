import type { BaseRecord } from "@refinedev/core";

/**
 * Shape is normalized from `GET /Sales`; extra fields are allowed for varying APIs.
 */
export type SaleRecord = BaseRecord & {
  id?: string;
  /** DB identifier — shown in the salesId column. */
  saleId?: string;
  /** Some APIs serialize PascalCase (`saleId` in C#). */
  SaleId?: string;
  salesId?: string;
  /** Some APIs serialize PascalCase. */
  SalesId?: string;
  sales_id?: string;
  outletId?: string;
  createdAt?: string;
  CreatedAt?: string;
  date?: string;
  soldAt?: string;
  total?: number;
  grandTotal?: number;
  amount?: number;
  Total?: number;
  customerName?: string;
  products?: string;
  Products?: string;
  productNames?: string;
  itemsCount?: number;
  ItemsCount?: number;
  itemCount?: number;
  items?: unknown[];
  lineItems?: unknown[];
  orderItems?: unknown[];
  customer?: { name?: string; phone?: string; address?: string };
  subtotal?: number;
  Subtotal?: number;
  /** Order-level discount; often `{ type, value, amount }` from API. */
  discount?: unknown;
  Discount?: unknown;
  paymentMode?: string;
  PaymentMode?: string;
};

export interface SaleLineItem {
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  productId?: string;
}

/** Matches `InvoiceData["discount"]` for thermal print. */
export type SaleOrderDiscount =
  | number
  | { amount?: number; type?: string; value?: number };

export type SalesGridRow = {
  id: string;
  salesId: string;
  products: string;
  itemsCount: number;
  amount: number;
  createdAt: string;
  /** ISO-ish timestamp from API when available (for invoice time). */
  createdAtIso?: string;
  /** Raw line items preserved for invoice printing */
  rawItems: SaleLineItem[];
  customer?: { name?: string; phone?: string; address?: string };
  subtotal?: number;
  discount?: SaleOrderDiscount;
  paymentMode?: string;
  /** Document id from API (`id` field) for PATCH /sales/:id */
  documentId?: string;
  outletId?: string;
  /** Business sale id without `#` (optional body.saleId) */
  plainSaleId?: string;
  /** Row originated from the offline queue — not yet in DB */
  pendingSync?: boolean;
  /** Offline queue exhausted retries — needs manual retry */
  syncFailed?: boolean;
  /** Offline queue localId for retry/remove operations */
  localId?: string;
};

function pickLineItems(record: SaleRecord): unknown[] {
  const raw = record.items ?? record.lineItems ?? record.orderItems;
  return Array.isArray(raw) ? raw : [];
}

export function getSaleRowId(record: SaleRecord, index: number): string {
  const id =
    record.saleId ??
    record.SaleId ??
    record.id ??
    record.salesId ??
    record.SalesId ??
    record.sales_id;
  return typeof id === "string" && id ? id : `sale-${index}`;
}

/** Value for the salesId grid column: always from DB field `saleId` / `SaleId`. */
export function getSalesIdDisplay(record: SaleRecord): string {
  const raw = record.saleId ?? record.SaleId;
  if (raw === undefined || raw === null) return "—";
  const s = String(raw).trim();
  if (!s) return "—";
  if (s.startsWith("#")) return s;
  return `#${s}`;
}

export function formatSaleProductsCell(record: SaleRecord): string {
  if (typeof record.products === "string" && record.products.trim()) {
    return record.products.trim();
  }
  if (typeof record.Products === "string" && record.Products.trim()) {
    return record.Products.trim();
  }
  if (typeof record.productNames === "string" && record.productNames.trim()) {
    return record.productNames.trim();
  }
  const raw = pickLineItems(record);
  if (raw.length === 0) return "—";

  const names: string[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const nested = o.product;
    const fromNested =
      nested && typeof nested === "object"
        ? (nested as Record<string, unknown>).name
        : undefined;
    const n =
      o.name ??
      o.productName ??
      o.title ??
      (typeof fromNested === "string" ? fromNested : undefined);
    if (typeof n === "string" && n.trim()) names.push(n.trim());
  }
  if (names.length === 0) return "—";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

export function getSaleItemsCount(record: SaleRecord): number {
  if (
    typeof record.itemsCount === "number" &&
    Number.isFinite(record.itemsCount)
  ) {
    return Math.floor(record.itemsCount);
  }
  if (
    typeof record.ItemsCount === "number" &&
    Number.isFinite(record.ItemsCount)
  ) {
    return Math.floor(record.ItemsCount);
  }
  if (
    typeof record.itemCount === "number" &&
    Number.isFinite(record.itemCount)
  ) {
    return Math.floor(record.itemCount);
  }
  const raw = pickLineItems(record);
  if (raw.length === 0) return 0;
  let sum = 0;
  for (const x of raw) {
    if (!x || typeof x !== "object") {
      sum += 1;
      continue;
    }
    const q = (x as Record<string, unknown>).quantity;
    if (typeof q === "number" && Number.isFinite(q)) {
      sum += q;
    } else {
      sum += 1;
    }
  }
  return Math.round(sum * 1000) / 1000;
}

export function getSaleAmountNumber(record: SaleRecord): number {
  const t =
    record.total ?? record.Total ?? record.grandTotal ?? record.amount;
  if (typeof t === "number" && Number.isFinite(t)) return t;
  return 0;
}

export function getSaleSubtotal(record: SaleRecord): number | undefined {
  const s = record.subtotal ?? record.Subtotal;
  if (typeof s === "number" && Number.isFinite(s)) return s;
  return undefined;
}

export function getSaleOrderDiscount(
  record: SaleRecord,
): SaleOrderDiscount | undefined {
  const d = record.discount ?? record.Discount;
  if (d == null) return undefined;
  if (typeof d === "number" && Number.isFinite(d)) return Math.max(0, d);
  if (typeof d === "object" && d !== null) {
    const o = d as Record<string, unknown>;
    const rawAmt = o.amount;
    const amount =
      typeof rawAmt === "number"
        ? rawAmt
        : typeof rawAmt === "string"
          ? Number(rawAmt)
          : NaN;
    if (!Number.isFinite(amount)) return undefined;
    const out: { amount: number; type?: string; value?: number } = {
      amount: Math.max(0, amount),
    };
    if (typeof o.type === "string" && o.type) out.type = o.type;
    const rawVal = o.value;
    if (typeof rawVal === "number" && Number.isFinite(rawVal)) {
      out.value = rawVal;
    } else if (typeof rawVal === "string") {
      const v = Number(rawVal);
      if (Number.isFinite(v)) out.value = v;
    }
    return out;
  }
  return undefined;
}

export function getSalePaymentMode(record: SaleRecord): string | undefined {
  const p = record.paymentMode ?? record.PaymentMode;
  if (typeof p === "string" && p.trim()) return p.trim();
  return undefined;
}

export function formatSaleCreatedAtLong(record: SaleRecord): string {
  const raw = record.createdAt ?? record.CreatedAt ?? record.date ?? record.soldAt;
  if (typeof raw !== "string" || !raw.trim()) return "—";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRupeeInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function extractLineItems(record: SaleRecord): SaleLineItem[] {
  const raw = pickLineItems(record);
  return raw.map((x) => {
    if (!x || typeof x !== "object") return { name: "?", unitPrice: 0, quantity: 1, lineTotal: 0 };
    const o = x as Record<string, unknown>;
    const name = String(o.name ?? o.productName ?? o.title ?? "?");
    const unitPrice = Number(o.unitPrice ?? o.price ?? 0) || 0;
    const quantity = Number(o.quantity ?? o.qty ?? 1) || 1;
    const lineTotal = Number(o.lineTotal ?? o.total ?? o.amount ?? unitPrice * quantity) || 0;
    const productIdRaw = o.productId ?? o.ProductId ?? o.product_id;
    const productId =
      productIdRaw != null && String(productIdRaw).trim()
        ? String(productIdRaw).trim()
        : undefined;
    return { name, unitPrice, quantity, lineTotal, productId };
  });
}

function getPlainSaleId(record: SaleRecord): string | undefined {
  const raw = record.saleId ?? record.SaleId;
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  return s || undefined;
}

function getCreatedAtIso(record: SaleRecord): string | undefined {
  const raw = record.createdAt ?? record.CreatedAt ?? record.date ?? record.soldAt;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return undefined;
  return new Date(t).toISOString();
}

export function saleRecordsToGridRows(records: SaleRecord[]): SalesGridRow[] {
  return records.map((r, index) => ({
    id: getSaleRowId(r, index),
    salesId: getSalesIdDisplay(r),
    products: formatSaleProductsCell(r),
    itemsCount: getSaleItemsCount(r),
    amount: getSaleAmountNumber(r),
    createdAt: formatSaleCreatedAtLong(r),
    createdAtIso: getCreatedAtIso(r),
    rawItems: extractLineItems(r),
    customer: r.customer,
    subtotal: getSaleSubtotal(r),
    discount: getSaleOrderDiscount(r),
    paymentMode: getSalePaymentMode(r),
    documentId:
      typeof r.id === "string" && r.id.trim() ? r.id.trim() : undefined,
    outletId:
      typeof r.outletId === "string" && r.outletId.trim()
        ? r.outletId.trim()
        : undefined,
    plainSaleId: getPlainSaleId(r),
  }));
}
