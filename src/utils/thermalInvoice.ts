import { numberToWordsIndian } from "./numberToWords";

export interface InvoiceItem {
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface InvoiceData {
  invoiceNo: string;
  date: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  total: number;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtINR(v: number): string {
  return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildThermalInvoiceHTML(data: InvoiceData): string {
  const { invoiceNo, date, customerName, customerPhone, customerAddress, items, total } = data;

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const amountWords = numberToWordsIndian(total);

  const itemRows = items
    .map((item, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td class="l name">${esc(item.name)}</td>
        <td class="r">${fmtINR(item.unitPrice)}</td>
        <td class="c">${item.quantity}</td>
        <td class="r">${fmtINR(item.lineTotal)}</td>
      </tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Invoice ${esc(invoiceNo)}</title>
<style>
  @page { size: 101.6mm auto; margin: 2mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 10px; color: #000; width: 101.6mm; margin: 0 auto; }

  .header { text-align:center; margin-bottom:6px; }
  .header .co { font-size:12px; font-weight:bold; margin-bottom:2px; }
  .header .sub { font-size:8px; margin-bottom:1px; }
  .header .phone { font-size:8px; margin-bottom:2px; }
  .header .gstin { font-size:9px; font-weight:bold; margin-bottom:4px; }

  .title { text-align:center; font-size:11px; font-weight:bold; border-top:1px solid #000; border-bottom:1px solid #000; padding:3px 0; margin-bottom:6px; }

  .details { margin-bottom:6px; }
  .details .row { display:flex; margin-bottom:2px; font-size:8px; }
  .details .lbl { font-weight:bold; width:38%; flex-shrink:0; }
  .details .val { width:62%; }

  table { width:100%; border-collapse:collapse; }
  th, td { font-size:8px; padding:2px 2px; }
  th { border-top:1px solid #000; border-bottom:1px solid #000; font-weight:bold; text-align:center; }
  td.c { text-align:center; }
  td.r { text-align:right; }
  td.l { text-align:left; }
  td.name { word-break:break-word; }

  .sep { border-top:1px solid #000; margin:4px 0; }
  .sep-double { border-top:2px solid #000; border-bottom:2px solid #000; padding:4px 0; margin:4px 0; display:flex; justify-content:space-between; font-size:11px; font-weight:bold; }

  .total-row { display:flex; justify-content:space-between; font-size:9px; font-weight:bold; margin-bottom:1px; }
  .rounded { display:flex; justify-content:space-between; font-size:8px; margin-bottom:4px; }

  .words { font-size:8px; font-style:italic; text-align:center; margin-bottom:6px; padding-bottom:4px; }

  .footer { text-align:center; border-top:1px solid #000; padding-top:5px; margin-top:6px; font-size:9px; font-weight:bold; }

  @media print {
    body { width: 101.6mm; }
    html, body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="co">NANNU AGRO PRIVATE LIMITED</div>
  <div class="sub">Village Buchi, Pundri, Kaithal</div>
  <div class="phone">Phone: 98127-12739, 92559-19666</div>
  <div class="gstin">GSTIN: 06AAECN2051P1ZB</div>
</div>

<div class="title">TAX INVOICE</div>

<div class="details">
  <div class="row"><span class="lbl">Invoice No/Date:</span><span class="val">${esc(invoiceNo)} / ${esc(date)}</span></div>
  ${customerName ? `<div class="row"><span class="lbl">Customer Name:</span><span class="val">${esc(customerName)}</span></div>` : ""}
  ${customerPhone ? `<div class="row"><span class="lbl">Cust Mobile No:</span><span class="val">${esc(customerPhone)}</span></div>` : ""}
  ${customerAddress ? `<div class="row"><span class="lbl">Address:</span><span class="val">${esc(customerAddress)}</span></div>` : ""}
</div>

<table>
  <thead>
    <tr>
      <th style="width:8%">Sl</th>
      <th style="width:37%">Product</th>
      <th style="width:18%">Price</th>
      <th style="width:12%">Qty</th>
      <th style="width:25%">Amt.</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
</table>

<div class="sep"></div>
<div class="total-row"><span>Total</span><span>${fmtINR(total)}</span></div>
<div class="rounded"><span>Add: Rounded Off (+)</span><span>0.00</span></div>
<div class="sep-double"><span>${totalQty.toFixed(3)}</span><span>${fmtINR(total)}</span></div>

<div class="words">Rupees ${esc(amountWords)} Only</div>

<div class="footer">THANK YOU. VISIT US AGAIN.</div>

<script>window.onload=function(){window.print();}<\/script>
</body>
</html>`;
}

export function printThermalInvoice(data: InvoiceData) {
  const html = buildThermalInvoiceHTML(data);
  const win = window.open("", "_blank");
  if (!win) {
    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
    return;
  }
  win.document.write(html);
  win.document.close();
}
