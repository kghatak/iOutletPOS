/** Ledger types used by the Reports page (matches order-admin ledger). */

// ── Raw API shapes ─────────────────────────────────────────────────

export interface RawOrder {
  id?: string;
  orderId?: string;
  OrderId?: string;
  saleId?: string;
  SaleId?: string;
  "parent orderId"?: string;
  outletId?: string;
  total?: number;
  Total?: number;
  grandTotal?: number;
  GrandTotal?: number;
  amount?: number;
  Amount?: number;
  "total amount"?: number;
  totalAmount?: number;
  totalPaymentAmount?: number;
  netAmount?: number;
  NetAmount?: number;
  createdAt?: string;
  CreatedAt?: string;
  "Created at"?: unknown;
  date?: string;
  orderDate?: string;
  OrderDate?: string;
  deliveredDate?: unknown;
  customerName?: string;
  customer?: { name?: string };
  outlet?: { id?: string; name?: string };
  gstType?: string;
  GstType?: string;
  taxType?: string;
  TaxType?: string;
  taxFree?: boolean;
  TaxFree?: boolean;
  items?: Array<{ taxFree?: boolean; gstRate?: number; [k: string]: unknown }>;
  [key: string]: unknown;
}

export interface RawPayment {
  id?: string;
  paymentId?: string;
  PaymentId?: string;
  outletId?: string;
  OutletId?: string;
  amount?: number;
  Amount?: number;
  createdAt?: string;
  CreatedAt?: string;
  date?: string;
  paymentDate?: unknown;
  PaymentDate?: string;
  approvedAt?: unknown;
  mode?: string;
  paymentMode?: string;
  PaymentMode?: string;
  reference?: string;
  remarks?: string;
  remark?: string;
  status?: string;
  outlet?: { id?: string; name?: string };
  [key: string]: unknown;
}

export interface RawReturn {
  id?: string;
  returnId?: string;
  ReturnId?: string;
  outletId?: string;
  OutletId?: string;
  amount?: number;
  Amount?: number;
  total?: number;
  Total?: number;
  totalAmount?: number;
  TotalAmount?: number;
  createdAt?: string;
  CreatedAt?: string;
  date?: string;
  returnDate?: string;
  ReturnDate?: string;
  reason?: string;
  status?: string;
  outlet?: { id?: string; name?: string };
  [key: string]: unknown;
}

export interface RawBalanceRow {
  OutletID?: string;
  outletId?: string;
  OutletId?: string;
  outletid?: string;
  totalClosingBalance?: number;
  TotalClosingBalance?: number;
  closingBalance?: number;
  ClosingBalance?: number;
  closingBalanceOrder?: number;
  closingBalancePayment?: number;
  closingBalanceReturn?: number;
  closingBanlanceReturn?: number;
  openingBalance?: number;
  OpeningBalance?: number;
  [key: string]: unknown;
}

export interface PendingOutletRow {
  pendingAmount?: number;
  PendingAmount?: number;
  balance?: number;
  Balance?: number;
  [key: string]: unknown;
}

// ── Ledger entry ───────────────────────────────────────────────────

export interface LedgerEntry {
  date: Date;
  sortDate: Date;
  /** "Sale" | "SIRt" | "Rcpt" */
  type: string;
  vchBillNo: string;
  account: string;
  debit: number;
  credit: number;
  narration: string;
  balance: number;
  balanceType: "Dr" | "Cr";
  cumulativeDebit: number;
  cumulativeCredit: number;
  globalIndex: number;
}

// ── Helpers ────────────────────────────────────────────────────────

function tsToDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    if (typeof o._seconds === "number") return new Date(o._seconds * 1000);
  }
  return null;
}

export function getOrderAmount(o: RawOrder): number {
  const v = o["total amount"] ?? o.totalAmount ?? o.totalPaymentAmount ?? o.grandTotal ?? o.GrandTotal ?? o.total ?? o.Total ?? o.netAmount ?? o.NetAmount ?? o.amount ?? o.Amount;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function getOrderDate(o: RawOrder): Date {
  return tsToDate(o.deliveredDate) ?? tsToDate(o.orderDate ?? o.OrderDate) ?? tsToDate(o["Created at"]) ?? tsToDate(o.createdAt ?? o.CreatedAt ?? o.date) ?? new Date();
}

export function getOrderSortDate(o: RawOrder): Date {
  return tsToDate(o.deliveredDate) ?? tsToDate(o["Created at"]) ?? tsToDate(o.createdAt ?? o.CreatedAt) ?? new Date();
}

export function getOrderId(o: RawOrder): string {
  const v = o["parent orderId"] ?? o.orderId ?? o.OrderId ?? o.saleId ?? o.SaleId ?? o.id;
  return v ? String(v) : "";
}

export function getOrderOutletId(o: RawOrder): string {
  return (o.outletId ?? o.outlet?.id ?? "") as string;
}

export function getOrderAccount(o: RawOrder): string {
  if (o.items && Array.isArray(o.items) && o.items.length > 0) {
    const allTaxFree = o.items.every(
      (item) => item.taxFree === true || item.gstRate === 0,
    );
    if (allTaxFree) return "Sale Tax Free";
  }
  const g = o.gstType ?? o.GstType ?? o.taxType ?? o.TaxType;
  if (typeof g === "string" && g.trim()) return `Sale ${g.trim()}`;
  if (o.taxFree === true || o.TaxFree === true) return "Sale Tax Free";
  return "Sale Gst 5%";
}

export function getPaymentAmount(p: RawPayment): number {
  const v = p.amount ?? p.Amount;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function getPaymentDate(p: RawPayment): Date {
  return tsToDate(p.paymentDate ?? p.PaymentDate) ?? tsToDate(p.approvedAt) ?? tsToDate(p.createdAt ?? p.CreatedAt ?? p.date) ?? new Date();
}

export function getPaymentId(p: RawPayment): string {
  const v = p.paymentId ?? p.PaymentId ?? p.id;
  return v ? String(v) : "";
}

export function getPaymentOutletId(p: RawPayment): string {
  return (p.outletId ?? p.OutletId ?? p.outlet?.id ?? "") as string;
}

export function normalizePaymentMode(raw: string | undefined): string {
  const s = (raw ?? "Cash").trim();
  const lower = s.toLowerCase();
  if (lower === "upi") return "UPI";
  if (lower === "cash") return "Cash";
  if (lower === "cheque") return "Cheque";
  if (lower === "transfer by bank" || lower === "bank transfer") return "Transfer by Bank";
  return s.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

export function getPaymentMode(p: RawPayment): string {
  return normalizePaymentMode(p.paymentMode ?? p.PaymentMode ?? p.mode);
}

export function getPaymentRemarks(p: RawPayment): string {
  return (p.remarks ?? p.remark ?? "").trim();
}

export function getPaymentStatus(p: RawPayment): string {
  return (p.status ?? "approved").toLowerCase();
}

export function getReturnAmount(r: RawReturn): number {
  const v = r.totalAmount ?? r.TotalAmount ?? r.amount ?? r.Amount ?? r.total ?? r.Total;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function getReturnDate(r: RawReturn): Date {
  return tsToDate(r.createdAt ?? r.CreatedAt ?? r.returnDate ?? r.ReturnDate ?? r.date) ?? new Date();
}

export function getReturnId(r: RawReturn): string {
  const v = r.returnId ?? r.ReturnId ?? r.id;
  return v ? String(v) : "";
}

export function getReturnOutletId(r: RawReturn): string {
  return (r.outletId ?? r.OutletId ?? r.outlet?.id ?? "") as string;
}

export function getReturnStatus(r: RawReturn): string {
  return (r.status ?? "").toLowerCase();
}

export function getBalanceForOutlet(rows: RawBalanceRow[], outletId: string): number | null {
  const match = rows.find((r) => {
    const id = r.OutletID ?? r.outletId ?? r.OutletId ?? r.outletid;
    return id != null && String(id) === outletId;
  });
  if (!match) return null;

  const closing = match.totalClosingBalance ?? match.TotalClosingBalance;
  if (typeof closing === "number" && Number.isFinite(closing)) return closing;

  const order = match.closingBalanceOrder;
  const payment = match.closingBalancePayment;
  const ret = match.closingBalanceReturn ?? match.closingBanlanceReturn;
  if (typeof order === "number" && typeof payment === "number") {
    return order - payment - (typeof ret === "number" ? ret : 0);
  }

  const simple = match.closingBalance ?? match.ClosingBalance;
  if (typeof simple === "number" && Number.isFinite(simple)) return simple;
  return null;
}

export function getPendingAmount(row: PendingOutletRow): number {
  const v = row.pendingAmount ?? row.PendingAmount ?? row.balance ?? row.Balance;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function formatINR(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}
