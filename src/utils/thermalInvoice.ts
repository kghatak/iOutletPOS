import { createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import type { InvoiceData, InvoiceItem } from "../types/thermalInvoice";
import { isSplitPaymentMode } from "../types/payment";
import { ThermalInvoicePdfDocument } from "../pdf/ThermalInvoicePdfDocument";
import { getSessionOutletPrintInfo } from "../providers/authProvider";

export type { InvoiceData, InvoiceItem } from "../types/thermalInvoice";

/** DD-MM-YYYY and HH:mm as used on 3″ receipts. */
export function invoiceReceiptStamp(): { date: string; billTime: string } {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const date = `${dd}-${mm}-${d.getFullYear()}`;
  const billTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, billTime };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;",
  );
}

function fmtInr(n: number): string {
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeDiscountAmount(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, v);
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  if (typeof v === "object" && v !== null && "amount" in v) {
    const a = (v as { amount?: unknown }).amount;
    if (typeof a === "number" && Number.isFinite(a)) return Math.max(0, a);
    if (typeof a === "string") {
      const n = Number(a);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    }
  }
  return 0;
}

function formatRetailBillDate(dateStr: string): string {
  const m = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[1]}/${m[2]}/${m[3].slice(-2)}`;
  const d = new Date(dateStr);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }
  return dateStr;
}

function displayBillNo(invoiceNo: string): string {
  return invoiceNo.replace(/^#/, "").trim();
}

function renderPaymentSectionHtml(data: InvoiceData): string {
  const mode = typeof data.paymentMode === "string" ? data.paymentMode.trim() : "";
  const payments = data.payments ?? [];

  if (isSplitPaymentMode(mode) && payments.length > 0) {
    const rows = payments
      .map(
        (p) =>
          `<div class="summary"><span>${escapeHtml(p.mode)}</span><span>${escapeHtml(fmtInr(p.amount))}</span></div>`,
      )
      .join("");
    const paidTotal = payments.reduce((s, p) => s + p.amount, 0);
    return `<div class="center bold meta-single">Payment (Split)</div>${rows}<div class="summary bold"><span>Total Paid</span><span>${escapeHtml(fmtInr(paidTotal))}</span></div>`;
  }

  if (mode) {
    return `<div class="center bold meta-single">Payment Mode: ${escapeHtml(mode)}</div>`;
  }

  return "";
}

function renderItemsRowsHtml(items: InvoiceItem[]): string {
  return items
    .map((item, idx) => {
      const qty = String(item.quantity ?? 0);
      const price = (item.unitPrice || 0).toFixed(2);
      const amount = (item.lineTotal || 0).toFixed(2);
      return `<tr>
        <td class="no">${idx + 1}</td>
        <td class="item">${escapeHtml(item.name)}</td>
        <td class="c">${escapeHtml(qty)}</td>
        <td class="r">${escapeHtml(price)}</td>
        <td class="r">${escapeHtml(amount)}</td>
      </tr>`;
    })
    .join("");
}

/**
 * Build a self-contained HTML document mirroring the 3″ receipt layout.
 * Page width is set to 72mm (the safe printable area on 3″ / 80mm rolls)
 * with `box-sizing: border-box` so no element exceeds the right margin.
 */
function buildThermalInvoiceHtml(data: InvoiceData): string {
  const items = data.items ?? [];
  const grossMerchandise = items.reduce(
    (s, i) => s + (i.unitPrice || 0) * (i.quantity || 0),
    0,
  );
  const sumLineTotals = items.reduce((s, i) => s + (i.lineTotal || 0), 0);
  const displaySubtotal =
    data.subtotal ?? Math.max(grossMerchandise, sumLineTotals);

  let discountAmt = normalizeDiscountAmount(data.discount);
  const netPayable = Number(data.total);
  if (discountAmt < 0.005 && Number.isFinite(netPayable)) {
    const implied = Math.round((displaySubtotal - netPayable) * 100) / 100;
    if (implied > 0.005) discountAmt = implied;
  }

  const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);

  const orderType = data.orderType ?? "Pick Up";
  const cashier = data.cashierName ?? "—";
  const billTime = data.billTime ?? "—";
  const billDate = formatRetailBillDate(data.date);
  const billNo = displayBillNo(String(data.invoiceNo));
  const outletInfo = getSessionOutletPrintInfo();
  const displayOutletAddress =
    outletInfo.address || "Village Buchi, Pundri, Kaithal";
  const displayOutletContact =
    outletInfo.primaryPhoneNumber || "98127-12739, 92559-19666";
  const paymentSection = renderPaymentSectionHtml(data);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice ${escapeHtml(billNo || "")}</title>
<style>
  /* 3" thermal printable width is ~72mm. Stay well inside that to avoid right-edge cropping. */
  @page { size: 72mm auto; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body {
    font-family: "Segoe UI", Roboto, Arial, sans-serif;
    width: 72mm;
    max-width: 72mm;
    padding: 2mm 2mm;
    font-size: 9pt;
    line-height: 1.25;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: 700; }
  .title  { font-size: 10pt; font-weight: 700; text-align: center; }
  .store  { font-size: 12pt; font-weight: 700; text-align: center; margin-top: 1mm; }
  .small  { font-size: 8pt; }
  .meta {
    display: flex;
    justify-content: space-between;
    gap: 1mm;
    font-size: 9pt;
    margin-bottom: 1mm;
  }
  .meta > span { min-width: 0; word-break: break-word; }
  .meta-single { font-size: 9pt; margin-bottom: 1mm; word-break: break-word; }
  hr.rule { border: 0; border-top: 1px solid #000; margin: 1.5mm 0; }
  table.items {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  table.items th,
  table.items td {
    padding: 0.6mm 0.4mm;
    font-size: 9pt;
    vertical-align: top;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  table.items thead th {
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
    font-size: 8pt;
  }
  table.items th.no, table.items td.no { width: 8%;  text-align: center; }
  table.items th.item, table.items td.item { width: 40%; text-align: left; padding-right: 1mm; }
  table.items th.qty, table.items td.c { width: 14%; text-align: center; }
  table.items th.price, table.items td.r { width: 18%; text-align: right; }
  table.items th.amt { width: 20%; text-align: right; }
  .summary {
    display: flex;
    justify-content: space-between;
    gap: 2mm;
    font-size: 9pt;
    margin-top: 1mm;
  }
  .summary > span { min-width: 0; word-break: break-word; }
  .gstNote { font-size: 8pt; text-align: center; font-style: italic; margin: 1.5mm 0; }
  .grand {
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
    text-align: center;
    font-size: 12pt;
    font-weight: 700;
    padding: 1.5mm 0;
    margin: 1.5mm 0;
    word-break: break-word;
  }
  .foot { font-size: 9pt; text-align: center; margin-top: 2mm; }
</style>
</head>
<body>
  <div class="title">RETAIL INVOICE</div>
  <div class="store">NANNU MILK</div>
  <div class="center small">Add: ${escapeHtml(displayOutletAddress)}</div>
  <div class="center small">Mob: ${escapeHtml(displayOutletContact)}</div>
  <hr class="rule" />

  <div class="meta-single">Name: ${escapeHtml(
    (data.customerName ?? "").trim() || "________________",
  )}</div>
  <hr class="rule" />

  <div class="meta">
    <span>Date: ${escapeHtml(billDate)}</span>
    <span>Order Type: ${escapeHtml(orderType)}</span>
  </div>
  <div class="meta">
    <span>Time: ${escapeHtml(billTime)}</span>
    <span>Cashier: ${escapeHtml(cashier)}</span>
  </div>
  <div class="meta-single">Bill No.: ${escapeHtml(billNo)}</div>
  <hr class="rule" />

  <table class="items">
    <thead>
      <tr>
        <th class="no">No.</th>
        <th class="item">Item</th>
        <th class="qty">Qty.</th>
        <th class="price">Price</th>
        <th class="amt">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${renderItemsRowsHtml(items)}
    </tbody>
  </table>

  <hr class="rule" />
  <div class="summary"><span>Total Qty</span><span>${escapeHtml(String(totalQty))}</span></div>
  <div class="summary"><span>Sub Total</span><span>${escapeHtml(displaySubtotal.toFixed(2))}</span></div>
  ${
    discountAmt > 0.005
      ? `<div class="summary"><span>Discount (-)</span><span>-${escapeHtml(
          discountAmt.toFixed(2),
        )}</span></div>`
      : ""
  }
  <div class="gstNote">[Net Total inclusive of GST]</div>
  <hr class="rule" />

  <div class="grand">Grand Total: Rs ${escapeHtml(fmtInr(netPayable))}</div>
  ${paymentSection}
  <hr class="rule" />

  <div class="foot">Thanks &amp; visit again...!!!</div>
</body>
</html>`;
}

function printInvoiceHtmlInIframe(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Thermal invoice");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";

    let cleanedUp = false;
    let loadTimeoutId: number | undefined;
    let afterPrintFallbackId: number | undefined;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (loadTimeoutId != null) window.clearTimeout(loadTimeoutId);
      if (afterPrintFallbackId != null) window.clearTimeout(afterPrintFallbackId);
      iframe.remove();
    };
    const succeed = () => {
      cleanup();
      resolve();
    };
    const fail = (reason: Error) => {
      cleanup();
      reject(reason);
    };

    loadTimeoutId = window.setTimeout(
      () => fail(new Error("Invoice HTML load timed out")),
      10_000,
    ) as unknown as number;

    iframe.onload = () => {
      if (loadTimeoutId != null) window.clearTimeout(loadTimeoutId);
      window.setTimeout(() => {
        try {
          const win = iframe.contentWindow;
          if (!win) {
            fail(new Error("No iframe window"));
            return;
          }
          win.addEventListener("afterprint", succeed, { once: true });
          afterPrintFallbackId = window.setTimeout(succeed, 120_000) as unknown as number;
          win.focus();
          win.print();
        } catch (e) {
          fail(e instanceof Error ? e : new Error(String(e)));
        }
      }, 60);
    };

    iframe.onerror = () => fail(new Error("Invoice HTML failed to load"));

    document.body.appendChild(iframe);
    iframe.srcdoc = html;
  });
}

async function openPdfFallback(data: InvoiceData): Promise<void> {
  const payload: InvoiceData = { ...data, paperWidth: "3inch" };
  const blob = await pdf(
    createElement(ThermalInvoicePdfDocument, { data: payload }) as Parameters<typeof pdf>[0],
  ).toBlob();
  const url = URL.createObjectURL(blob);
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) window.open(url, "_blank");
}

/**
 * Auto-print 3″ thermal invoice: renders HTML in a hidden iframe and fires
 * `print()`. Falls back to PDF tab if the iframe path is unavailable.
 */
export async function printThermalInvoice(data: InvoiceData): Promise<void> {
  const html = buildThermalInvoiceHtml(data);
  try {
    await printInvoiceHtmlInIframe(html);
  } catch (e) {
    console.warn("HTML auto-print failed, falling back to PDF:", e);
    try {
      await openPdfFallback(data);
    } catch (pdfErr) {
      console.error("PDF fallback also failed:", pdfErr);
    }
  }
}
