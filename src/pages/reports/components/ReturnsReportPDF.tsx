import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { getHSNCode, formatCurrencyWithCommas, formatDateForLedger } from "../utils/pdfHelpers";
import numberToWordsIndian from "../../../utils/numberToWordsIndian";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;
type ReturnItem = AnyRecord;

interface ReturnsReportPDFProps {
  reportData: AnyRecord[];
  outletName?: string;
}

function getOutletName(outlet: unknown, fallback?: string): string {
  if (!outlet) return fallback ?? "N/A";
  if (typeof outlet === "string") return outlet;
  if (typeof outlet === "object" && outlet !== null) {
    const o = outlet as Record<string, unknown>;
    if (typeof o.name === "string") return o.name;
  }
  return fallback ?? "N/A";
}

const DEFAULT_GST = 5;

function getGSTRate(item: ReturnItem): number {
  return item.gst != null && item.gst > 0 ? item.gst : DEFAULT_GST;
}

function getItemHSN(item: ReturnItem): string {
  if (item.hsn_sac_code && item.hsn_sac_code !== "--") return item.hsn_sac_code;
  if (item.name) return getHSNCode(item.name);
  return "--";
}

interface ItemTotals {
  listPrice: number;
  quantity: number;
  discountPercentage: number;
  discountAmount: number;
  taxableAmount: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  totalGST: number;
  finalAmount: number;
}

function calcItemTotals(item: ReturnItem): ItemTotals {
  // Support both "price" (order-admin) and "unitPrice" (iOutletPOS)
  const listPrice = item.price ?? item.unitPrice ?? 0;
  const quantity = item.quantity ?? 0;
  const discountPercentage = item.discountPercentage ?? 0;
  const subtotal = listPrice * quantity;
  const discountAmount = (subtotal * discountPercentage) / 100;
  const amountAfterDiscount = subtotal - discountAmount;
  const gstRate = getGSTRate(item);
  const taxableAmount = amountAfterDiscount / (1 + gstRate / 100);
  const totalGST = taxableAmount * (gstRate / 100);
  return {
    listPrice,
    quantity,
    discountPercentage,
    discountAmount,
    taxableAmount,
    gstRate,
    cgstAmount: totalGST / 2,
    sgstAmount: totalGST / 2,
    totalGST,
    finalAmount: amountAfterDiscount,
  };
}

function calcReturnTotals(items: ReturnItem[]) {
  let totalQuantity = 0;
  let totalTaxableAmount = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalGST = 0;
  let totalAmount = 0;
  const gstGroups: Record<number, { taxable: number; cgst: number; sgst: number; total: number }> = {};

  items.forEach((item) => {
    const t = calcItemTotals(item);
    totalQuantity += t.quantity;
    totalTaxableAmount += t.taxableAmount;
    totalCGST += t.cgstAmount;
    totalSGST += t.sgstAmount;
    totalGST += t.totalGST;
    totalAmount += t.finalAmount;

    if (!gstGroups[t.gstRate]) gstGroups[t.gstRate] = { taxable: 0, cgst: 0, sgst: 0, total: 0 };
    gstGroups[t.gstRate].taxable += t.taxableAmount;
    gstGroups[t.gstRate].cgst += t.cgstAmount;
    gstGroups[t.gstRate].sgst += t.sgstAmount;
    gstGroups[t.gstRate].total += t.totalGST;
  });

  return { totalQuantity, totalTaxableAmount, totalCGST, totalSGST, totalGST, totalAmount, gstGroups };
}

const s = StyleSheet.create({
  page: { flexDirection: "column", backgroundColor: "#ffffff", padding: 20, fontSize: 9, fontFamily: "Helvetica" },
  header: { border: "1px solid #000", padding: 5 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  headerCenter: { textAlign: "center", marginBottom: 5 },
  detailsContainer: { borderLeft: "1px solid #000", borderRight: "1px solid #000", borderBottom: "1px solid #000" },
  detailsRow: { flexDirection: "row", borderBottom: "1px solid #000" },
  detailColBorder: { flex: 1, padding: 4, borderRight: "1px solid #000" },
  detailCol: { flex: 1, padding: 4 },
  detailItem: { flexDirection: "row", marginBottom: 2 },
  detailLabel: { minWidth: 100, fontWeight: "bold" },
  itemsTable: { borderLeft: "1px solid #000", borderRight: "1px solid #000", borderBottom: "1px solid #000" },
  tableHeader: { flexDirection: "row", borderBottom: "1px solid #000" },
  th: { fontWeight: "bold", textAlign: "center", padding: 4, borderRight: "1px solid #000", fontSize: 7 },
  td: { padding: 3, borderRight: "1px solid #000", fontSize: 7 },
  tableRow: { flexDirection: "row", minHeight: 18 },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 4, borderLeft: "1px solid #000", borderRight: "1px solid #000", borderBottom: "1px solid #000" },
  taxSection: { border: "1px solid #000", borderTop: "none" },
  taxSummaryRow: { flexDirection: "row", borderBottom: "1px solid #000" },
  taxTable: { flex: 3 },
  taxTH: { flexDirection: "row", borderBottom: "1px solid #000", fontWeight: "bold" },
  taxCell: { padding: 2, flex: 1, textAlign: "right", borderRight: "1px solid #000", fontSize: 8 },
  taxTR: { flexDirection: "row" },
  taxTotalRow: { flexDirection: "row", borderTop: "1px solid #000", fontWeight: "bold" },
  footer: { borderTop: "1px solid #000", flexDirection: "row", minHeight: 80 },
  footerLeft: { flex: 1.2, padding: 4, borderRight: "1px solid #000" },
  footerRight: { flex: 1, flexDirection: "column" },
});

// Column widths (must sum to 100%)
const COL = {
  sn: "4%",
  desc: "18%",
  hsn: "8%",
  qty: "6%",
  unit: "5%",
  listPrice: "8%",
  discount: "7%",
  discPct: "6%",
  cgstRate: "6%",
  cgstAmt: "7%",
  sgstRate: "6%",
  sgstAmt: "7%",
  amount: "12%",
};

export const ReturnsReportPDF: React.FC<ReturnsReportPDFProps> = ({ reportData, outletName }) => {
  if (!reportData || reportData.length === 0) {
    return (
      <Document>
        <Page size="A4" style={s.page}>
          <Text>No return data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {reportData.map((rec, returnIndex) => {
        const items: ReturnItem[] = Array.isArray(rec.items) ? rec.items : [];
        const totals = calcReturnTotals(items);
        const returnDate = formatDateForLedger(rec.collectedDate ?? rec.createdAt ?? new Date());
        const returnId = String(rec.returnId ?? rec.id ?? `RET-${returnIndex + 1}`);
        const outlet = getOutletName(rec.outlet, outletName);
        const displayTotal = typeof rec.totalAmount === "number" && rec.totalAmount > 0
          ? rec.totalAmount
          : totals.totalAmount;
        const emptyRows = Math.max(0, 20 - items.length);

        return (
          <Page key={returnIndex} size="A4" style={s.page}>
            {/* Header */}
            <View style={s.header}>
              <View style={s.headerTop}>
                <Text style={{ fontSize: 10, fontWeight: "bold" }}>GSTIN : 06AAECN2051P1ZB</Text>
                <Text style={{ fontSize: 10, fontStyle: "italic" }}>Original Copy</Text>
              </View>
              <View style={s.headerCenter}>
                <Text style={{ fontSize: 14, fontWeight: "bold", textDecoration: "underline", marginBottom: 3 }}>Credit Note</Text>
                <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 3 }}>NANNU AGRO PRIVATE LIMITED</Text>
                <Text style={{ fontSize: 8, marginBottom: 2 }}>Village Buchi, Pundri, Kaithal</Text>
                <Text style={{ fontSize: 8 }}>Tel. : 98127-12739, 92559-19666  email : nannuago@gmail.com</Text>
              </View>
            </View>

            {/* Details */}
            <View style={s.detailsContainer}>
              <View style={s.detailsRow}>
                <View style={s.detailColBorder}>
                  <View style={s.detailItem}>
                    <Text style={[s.detailLabel, { fontStyle: "italic" }]}>Party Details :</Text>
                    <Text>{outlet}</Text>
                  </View>
                </View>
                <View style={s.detailCol}>
                  {[
                    ["Cr. Note No. :", returnId],
                    ["Cr. Note Date :", returnDate],
                    ["Org. Inv. No. :", ""],
                    ["Org. Inv. Date :", returnDate],
                  ].map(([label, value]) => (
                    <View key={label} style={s.detailItem}>
                      <Text style={s.detailLabel}>{label}</Text>
                      <Text>{value}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={s.detailsRow}>
                <View style={s.detailCol}>
                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>GSTIN / UIN :</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Items table */}
            <View style={s.itemsTable}>
              <View style={s.tableHeader}>
                <Text style={[s.th, { width: COL.sn }]}>S.N.</Text>
                <Text style={[s.th, { width: COL.desc, textAlign: "left" }]}>Description of Goods</Text>
                <Text style={[s.th, { width: COL.hsn }]}>HSN/SAC Code</Text>
                <Text style={[s.th, { width: COL.qty }]}>Qty.</Text>
                <Text style={[s.th, { width: COL.unit }]}>Unit</Text>
                <Text style={[s.th, { width: COL.listPrice }]}>List Price</Text>
                <Text style={[s.th, { width: COL.discount }]}>Discount</Text>
                <Text style={[s.th, { width: COL.discPct }]}>Discount (%)</Text>
                <Text style={[s.th, { width: COL.cgstRate }]}>CGST Rate</Text>
                <Text style={[s.th, { width: COL.cgstAmt }]}>CGST Amount</Text>
                <Text style={[s.th, { width: COL.sgstRate }]}>SGST Rate</Text>
                <Text style={[s.th, { width: COL.sgstAmt }]}>SGST Amount</Text>
                <Text style={[s.th, { width: COL.amount, borderRight: undefined }]}>Amount(*)</Text>
              </View>

              {items.map((item, idx) => {
                const t = calcItemTotals(item);
                return (
                  <View key={idx} style={s.tableRow}>
                    <Text style={[s.td, { width: COL.sn, textAlign: "center" }]}>{idx + 1}</Text>
                    <Text style={[s.td, { width: COL.desc, textAlign: "left" }]}>{item.name ?? "N/A"}</Text>
                    <Text style={[s.td, { width: COL.hsn, textAlign: "center" }]}>{getItemHSN(item)}</Text>
                    <Text style={[s.td, { width: COL.qty, textAlign: "right" }]}>{t.quantity.toFixed(3)}</Text>
                    <Text style={[s.td, { width: COL.unit, textAlign: "center" }]}>Kgs.</Text>
                    <Text style={[s.td, { width: COL.listPrice, textAlign: "right" }]}>{t.listPrice.toFixed(2)}</Text>
                    <Text style={[s.td, { width: COL.discount, textAlign: "right" }]}>{t.discountAmount.toFixed(2)}</Text>
                    <Text style={[s.td, { width: COL.discPct, textAlign: "right" }]}>{t.discountPercentage.toFixed(2)}%</Text>
                    <Text style={[s.td, { width: COL.cgstRate, textAlign: "right" }]}>{(t.gstRate / 2).toFixed(2)}%</Text>
                    <Text style={[s.td, { width: COL.cgstAmt, textAlign: "right" }]}>{t.cgstAmount.toFixed(2)}</Text>
                    <Text style={[s.td, { width: COL.sgstRate, textAlign: "right" }]}>{(t.gstRate / 2).toFixed(2)}%</Text>
                    <Text style={[s.td, { width: COL.sgstAmt, textAlign: "right" }]}>{t.sgstAmount.toFixed(2)}</Text>
                    <Text style={[s.td, { width: COL.amount, borderRight: undefined, textAlign: "right" }]}>{t.finalAmount.toFixed(2)}</Text>
                  </View>
                );
              })}

              {Array.from({ length: emptyRows }).map((_, i) => (
                <View key={`e${i}`} style={s.tableRow}>
                  {Object.values(COL).map((w, j, arr) => (
                    <Text key={j} style={[s.td, { width: w, borderRight: j === arr.length - 1 ? undefined : "1px solid #000" }]}> </Text>
                  ))}
                </View>
              ))}
            </View>

            {/* Grand Total */}
            <View style={s.grandTotalRow}>
              <Text style={{ fontWeight: "bold", fontSize: 10 }}>
                Grand Total{"     "}{totals.totalQuantity.toFixed(3)} Kgs.
              </Text>
              <Text style={{ fontWeight: "bold", fontSize: 12, textAlign: "right" }}>
                {formatCurrencyWithCommas(displayTotal)}
              </Text>
            </View>

            {/* Tax + Footer */}
            <View style={s.taxSection}>
              <View style={s.taxSummaryRow}>
                <View style={s.taxTable}>
                  <View style={s.taxTH}>
                    {["Tax Rate", "Taxable Amt.", "CGST Amt.", "SGST Amt.", "Total Tax"].map((h, i, arr) => (
                      <Text key={h} style={[s.taxCell, { textAlign: "center", borderRight: i < arr.length - 1 ? "1px solid #000" : undefined }]}>{h}</Text>
                    ))}
                  </View>
                  {Object.entries(totals.gstGroups).map(([rate, data]) => (
                    <View key={rate} style={s.taxTR}>
                      <Text style={[s.taxCell, { textAlign: "left" }]}>{rate}%</Text>
                      <Text style={s.taxCell}>{formatCurrencyWithCommas(data.taxable)}</Text>
                      <Text style={s.taxCell}>{formatCurrencyWithCommas(data.cgst)}</Text>
                      <Text style={s.taxCell}>{formatCurrencyWithCommas(data.sgst)}</Text>
                      <Text style={[s.taxCell, { borderRight: undefined }]}>{formatCurrencyWithCommas(data.total)}</Text>
                    </View>
                  ))}
                  <View style={s.taxTotalRow}>
                    <Text style={[s.taxCell, { textAlign: "left" }]}>Total</Text>
                    <Text style={s.taxCell}>{formatCurrencyWithCommas(totals.totalTaxableAmount)}</Text>
                    <Text style={s.taxCell}>{formatCurrencyWithCommas(totals.totalCGST)}</Text>
                    <Text style={s.taxCell}>{formatCurrencyWithCommas(totals.totalSGST)}</Text>
                    <Text style={[s.taxCell, { borderRight: undefined }]}>{formatCurrencyWithCommas(totals.totalGST)}</Text>
                  </View>
                </View>
                <View style={{ flex: 1.5, borderLeft: "1px solid #000" }} />
              </View>

              {/* Amount in words */}
              <View style={{ padding: 4, borderBottom: "1px solid #000" }}>
                <Text style={{ fontWeight: "bold", fontSize: 9 }}>
                  Rupees {numberToWordsIndian(displayTotal)}
                </Text>
              </View>

              {/* Signatures */}
              <View style={s.footer}>
                <View style={s.footerLeft}>
                  <Text style={{ fontWeight: "bold", fontSize: 8, textDecoration: "underline", marginBottom: 2 }}>Terms & Conditions</Text>
                  <Text style={{ fontSize: 7, lineHeight: 1.3 }}>E.& O.E.</Text>
                </View>
                <View style={s.footerRight}>
                  <View style={{ minHeight: 35, borderBottom: "1px solid #000", padding: 4, justifyContent: "flex-end" }}>
                    <Text style={{ fontSize: 10 }}>Receiver's Signature :</Text>
                  </View>
                  <View style={{ padding: 4, textAlign: "center", flexGrow: 1, justifyContent: "flex-end" }}>
                    <Text style={{ fontWeight: "bold", fontSize: 10, marginBottom: 25 }}>For NANNU AGRO PRIVATE LIMITED</Text>
                    <Text style={{ fontWeight: "bold", fontSize: 9 }}>Authorised Signatory</Text>
                  </View>
                </View>
              </View>
            </View>
          </Page>
        );
      })}
    </Document>
  );
};
