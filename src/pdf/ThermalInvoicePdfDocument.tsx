import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { InvoiceData, InvoiceItem } from "../types/thermalInvoice";
import { numberToWordsIndian } from "../utils/numberToWords";

/** Cart uses a number; API payloads may use `{ amount }`. */
function normalizeInvoiceDiscount(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, v);
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  if (typeof v === "object" && v !== null && "amount" in v) {
    const a = (v as { amount: unknown }).amount;
    if (typeof a === "number" && Number.isFinite(a)) return Math.max(0, a);
    if (typeof a === "string") {
      const n = Number(a);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    }
  }
  return 0;
}

function fmtInrPdf(n: number): string {
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getHSNCode(item: InvoiceItem): string {
  if (item.hsn_sac_code && item.hsn_sac_code !== "--") return item.hsn_sac_code;
  const iconHsnMap: Record<string, string> = {
    milk: "0401",
    sweet: "1704990",
    ghee: "04059020",
    sweet_box: "04021010",
    namkeen: "1906890",
  };
  if (item.icon && iconHsnMap[item.icon]) return iconHsnMap[item.icon];
  return "--";
}

/** 3″ roll ≈ 76.2mm × 216pt */
const theme3inch = { widthPt: 216 };

/** 3″ retail bill — minimal fields only (no tax / HSN breakdown). */
const retail3 = StyleSheet.create({
  page: {
    width: "76.2mm",
    padding: 6,
    backgroundColor: "#ffffff",
    fontSize: 9,
  },
  rule: {
    borderTop: "1px solid #000",
    width: "100%",
    marginTop: 5,
    marginBottom: 5,
  },
  retailTitle: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  storeName: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 2,
  },
  centerLine: {
    fontSize: 9,
    textAlign: "center",
    marginBottom: 1,
  },
  metaPair: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    marginBottom: 3,
  },
  metaSingle: { fontSize: 9, marginBottom: 3 },
  tableHeader: {
    flexDirection: "row",
    borderTop: "1px solid #000",
    borderBottom: "1px solid #000",
    paddingVertical: 3,
    marginTop: 2,
  },
  th: { fontSize: 8, fontWeight: "bold" },
  tr: { flexDirection: "row", marginTop: 4, alignItems: "flex-start" },
  colNo: { width: "10%", fontSize: 9, textAlign: "center" },
  colItem: { width: "36%", fontSize: 9, textAlign: "left", paddingRight: 2 },
  colQty: { width: "14%", fontSize: 9, textAlign: "center" },
  colPrice: { width: "18%", fontSize: 9, textAlign: "right" },
  colAmt: { width: "22%", fontSize: 9, textAlign: "right" },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    marginTop: 3,
  },
  gstNote: {
    fontSize: 8,
    textAlign: "center",
    fontStyle: "italic",
    marginVertical: 3,
  },
  grandWrap: {
    borderTop: "1px solid #000",
    borderBottom: "1px solid #000",
    marginVertical: 4,
    paddingVertical: 5,
  },
  grandText: { fontSize: 13, fontWeight: "bold", textAlign: "center" },
  foot: { fontSize: 9, textAlign: "center", marginTop: 5 },
});

function formatRetailBillDate(dateStr: string): string {
  const m = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) {
    return `${m[1]}/${m[2]}/${m[3].slice(-2)}`;
  }
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

type Props = { data: InvoiceData };

export function ThermalInvoicePdfDocument({ data }: Props) {
  const pageWidthPt = theme3inch.widthPt;

  const {
    invoiceNo,
    date,
    customerName,
    customerPhone: _customerPhone,
    customerGst: _customerGst,
    customerAddress: _customerAddress,
    items,
    subtotal,
    discount: totalDiscount,
    total,
    paymentMode: _paymentMode,
  } = data;

  const grossMerchandise = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const sumLineTotals = items.reduce((s, i) => s + i.lineTotal, 0);
  /** Pre–order-discount base: explicit subtotal, else max(price×qty, Σ lineTotal) for mixed API shapes */
  const displaySubtotal = subtotal ?? Math.max(grossMerchandise, sumLineTotals);

  let discountAmt = normalizeInvoiceDiscount(totalDiscount);
  const netPayable = Number(total);
  /* Sales re-print: API often sends final `total` with discount applied but omits `discount` */
  if (discountAmt < 0.005 && Number.isFinite(netPayable)) {
    const implied = Math.round((displaySubtotal - netPayable) * 100) / 100;
    if (implied > 0.005) discountAmt = implied;
  }

  const totalQtySimple = items.reduce(
    (s, i) => s + (Number(i.quantity) || 0),
    0,
  );

  {
    const orderType = data.orderType ?? "Pick Up";
    const cashier = data.cashierName ?? "—";
    const billTime = data.billTime ?? "—";
    const billDate = formatRetailBillDate(date);
    const billNo = displayBillNo(String(invoiceNo));

    return (
      <Document>
        <Page size={[pageWidthPt, 2000]} style={retail3.page}>
          <Text style={retail3.retailTitle}>RETAIL INVOICE</Text>
          <Text style={retail3.storeName}>NANNU AGRO PRIVATE LIMITED</Text>
          <Text style={retail3.centerLine}>Add: Village Buchi, Pundri, Kaithal</Text>
          <Text style={retail3.centerLine}>mob: 98127-12739, 92559-19666</Text>
          <View style={retail3.rule} />

          <Text style={retail3.metaSingle}>
            Name: {customerName?.trim() || "________________"}
          </Text>
          <View style={retail3.rule} />

          <View style={retail3.metaPair}>
            <Text>Date: {billDate}</Text>
            <Text>Order Type: {orderType}</Text>
          </View>
          <View style={retail3.metaPair}>
            <Text>Time: {billTime}</Text>
            <Text>Cashier: {cashier}</Text>
          </View>
          <Text style={retail3.metaSingle}>Bill No.: {billNo}</Text>
          <View style={retail3.rule} />

          <View style={retail3.tableHeader}>
            <Text style={[retail3.th, { width: "10%", textAlign: "center" }]}>No.</Text>
            <Text style={[retail3.th, { width: "36%", textAlign: "left" }]}>Item</Text>
            <Text style={[retail3.th, { width: "14%", textAlign: "center" }]}>Qty.</Text>
            <Text style={[retail3.th, { width: "18%", textAlign: "right" }]}>Price</Text>
            <Text style={[retail3.th, { width: "22%", textAlign: "right" }]}>Amount</Text>
          </View>

          {items.map((item, index) => (
            <View key={`r3-${item.name}-${index}`} style={retail3.tr}>
              <Text style={retail3.colNo}>{index + 1}</Text>
              <Text style={retail3.colItem}>{item.name}</Text>
              <Text style={retail3.colQty}>{String(item.quantity ?? 0)}</Text>
              <Text style={retail3.colPrice}>{(item.unitPrice || 0).toFixed(2)}</Text>
              <Text style={retail3.colAmt}>{item.lineTotal.toFixed(2)}</Text>
            </View>
          ))}

          <View style={retail3.rule} />
          <View style={retail3.summaryRow}>
            <Text>Total Qty</Text>
            <Text>{String(totalQtySimple)}</Text>
          </View>
          <View style={retail3.summaryRow}>
            <Text>Sub Total</Text>
            <Text>{displaySubtotal.toFixed(2)}</Text>
          </View>
          {discountAmt > 0.005 ? (
            <View style={retail3.summaryRow}>
              <Text>Discount (-)</Text>
              <Text>-{discountAmt.toFixed(2)}</Text>
            </View>
          ) : null}
          <Text style={retail3.gstNote}>[Net Total inclusive of GST]</Text>
          <View style={retail3.rule} />

          <View style={retail3.grandWrap}>
            <Text style={retail3.grandText}>
              Grand Total: ₹{fmtInrPdf(netPayable)}
            </Text>
          </View>
          <View style={retail3.rule} />

          <Text style={retail3.foot}>Thanks & visit again...!!!</Text>
        </Page>
      </Document>
    );
  }
}
