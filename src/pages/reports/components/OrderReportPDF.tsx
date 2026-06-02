import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { getHSNCode } from "../utils/pdfHelpers";
import numberToWordsIndian from "../../../utils/numberToWordsIndian";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface OrderReportPDFProps {
  // Accept any array so RawOrder[] (from ledger types) can be passed without conflict
  reportData: AnyRecord[];
}

function getOutletName(outlet: unknown): string {
  if (!outlet) return "N/A";
  if (typeof outlet === "string") return outlet;
  if (typeof outlet === "object" && outlet !== null) {
    const o = outlet as Record<string, unknown>;
    return String(o.name ?? JSON.stringify(outlet));
  }
  return String(outlet);
}

function getOrderDate(record: AnyRecord): string {
  const raw = record["Created at"] ?? record.createdAt;
  if (!raw) return "N/A";
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    if (typeof o._seconds === "number") {
      return new Date(o._seconds * 1000).toLocaleDateString("en-GB").replace(/\//g, "-");
    }
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("en-GB").replace(/\//g, "-");
  }
  return "N/A";
}

function getTotalAmount(record: AnyRecord): number {
  const v = record["total amount"] ?? record.totalAmount ?? record.total;
  return typeof v === "number" && isFinite(v) ? v : 0;
}

export const OrderReportPDF: React.FC<OrderReportPDFProps> = ({ reportData }) => {
  return (
    <Document>
      {reportData.map((order, index) => {
        const orderId = String(order["parent orderId"] ?? order.id ?? `ORD-${index + 1}`);
        const orderDate = getOrderDate(order);
        const outletName = getOutletName(order.outlet);
        const totalAmt = getTotalAmount(order);
        const transport = String(order.transport ?? "To Pay");
        const items: AnyRecord[] = Array.isArray(order.items) ? order.items : [];

        const totalQuantity = items.reduce((s, i) => s + ((i.quantity ?? 0) as number), 0);

        const totals = (() => {
          let taxableVal = 0;
          let totalTax = 0;
          items.forEach((item) => {
            const unitPrice = (item.price ?? item.unitPrice ?? 0) as number;
            const qty = (item.quantity ?? 0) as number;
            const discPct = (item.discountPercentage ?? 0) as number;
            const discAmt = (item.discountAmount ?? (unitPrice * qty * discPct / 100)) as number;
            const finalAmt = unitPrice * qty - discAmt;
            const gst = (item.gst ?? 0) as number;
            if (gst > 0) {
              const taxable = finalAmt / (1 + gst / 100);
              taxableVal += taxable;
              totalTax += taxable * (gst / 100);
            } else {
              taxableVal += finalAmt;
            }
          });
          return { taxableVal, totalTax, cgst: totalTax / 2, sgst: totalTax / 2 };
        })();

        const MIN_ROWS = 12;
        const emptyRows = Math.max(0, MIN_ROWS - items.length);

        return (
          <Page key={index} size="A4" style={{ padding: 20, fontSize: 9, fontFamily: "Helvetica" }}>
            {/* Header */}
            <View style={{ border: "1px solid #000", padding: 5 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: "bold" }}>GSTIN : 06AAECN2051P1ZB</Text>
                <Text style={{ fontSize: 10, fontStyle: "italic" }}>Original Copy</Text>
              </View>
              <View style={{ textAlign: "center", marginBottom: 5 }}>
                <Text style={{ fontSize: 14, fontWeight: "bold", textDecoration: "underline", marginBottom: 3 }}>
                  TAX INVOICE
                </Text>
                <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 3 }}>
                  NANNU AGRO PRIVATE LIMITED
                </Text>
                <Text style={{ fontSize: 8, marginBottom: 2 }}>Village Buchi, Pundri, Kaithal</Text>
                <Text style={{ fontSize: 8 }}>Tel.: 98127-12739, 92559-19666  email: nannuago@gmail.com</Text>
              </View>
            </View>

            {/* Invoice details */}
            <View style={{ borderLeft: "1px solid #000", borderRight: "1px solid #000", borderBottom: "1px solid #000" }}>
              <View style={{ flexDirection: "row", borderBottom: "1px solid #000" }}>
                <View style={{ flex: 1, padding: 4, borderRight: "1px solid #000" }}>
                  {[
                    ["Invoice No.", orderId],
                    ["Dated", orderDate],
                    ["Place of Supply", "Haryana (06)"],
                    ["Reverse Charge", "N"],
                    ["GR/RR No.", ""],
                  ].map(([label, value]) => (
                    <View key={label} style={{ flexDirection: "row", marginBottom: 2 }}>
                      <Text style={{ minWidth: 80, fontWeight: "bold" }}>{label}</Text>
                      <Text>: {value}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flex: 1, padding: 4 }}>
                  {[
                    ["Transport", transport],
                    ["Vehicle No.", ""],
                    ["Station", ""],
                    ["E-Way Bill No.", ""],
                  ].map(([label, value]) => (
                    <View key={label} style={{ flexDirection: "row", marginBottom: 2 }}>
                      <Text style={{ minWidth: 80, fontWeight: "bold" }}>{label}</Text>
                      <Text>: {value}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={{ flexDirection: "row", borderBottom: "1px solid #000" }}>
                <View style={{ flex: 1, padding: 4, borderRight: "1px solid #000" }}>
                  <Text style={{ fontWeight: "bold", marginBottom: 2 }}>Billed to :</Text>
                  <Text style={{ fontSize: 10 }}>{outletName}</Text>
                </View>
                <View style={{ flex: 1, padding: 4 }}>
                  <Text style={{ fontWeight: "bold", marginBottom: 2 }}>Shipped to :</Text>
                  <Text style={{ fontSize: 10 }}>{outletName}</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row" }}>
                <View style={{ flex: 1, padding: 4, borderRight: "1px solid #000" }}>
                  <Text>GSTIN / UIN :</Text>
                </View>
                <View style={{ flex: 1, padding: 4 }}>
                  <Text>GSTIN / UIN :</Text>
                </View>
              </View>
            </View>

            {/* Items table */}
            <View style={{ borderLeft: "1px solid #000", borderRight: "1px solid #000", borderBottom: "1px solid #000" }}>
              {/* Table header */}
              <View style={{ flexDirection: "row", borderBottom: "1px solid #000" }}>
                {[
                  { label: "S.N.", w: "5%", align: "center" as const },
                  { label: "Description of Goods", w: "30%", align: "left" as const },
                  { label: "HSN/SAC", w: "11%", align: "center" as const },
                  { label: "Qty.", w: "8%", align: "center" as const },
                  { label: "Unit", w: "6%", align: "center" as const },
                  { label: "List Price", w: "9%", align: "center" as const },
                  { label: "Discount", w: "11%", align: "center" as const },
                  { label: "Price", w: "9%", align: "center" as const },
                  { label: "Amount( \u20B9 )", w: "11%", align: "center" as const, last: true },
                ].map(({ label, w, align, last }) => (
                  <Text
                    key={label}
                    style={{
                      width: w,
                      fontWeight: "bold",
                      textAlign: align,
                      padding: 4,
                      borderRight: last ? undefined : "1px solid #000",
                      fontSize: 8,
                    }}
                  >
                    {label}
                  </Text>
                ))}
              </View>

              {/* Data rows */}
              {items.map((item, idx) => {
                // Support both "price" (order-admin) and "unitPrice" (iOutletPOS)
                const unitPrice: number = (item.price ?? item.unitPrice ?? 0) as number;
                const qty: number = (item.quantity ?? 0) as number;
                const discPct: number = (item.discountPercentage ?? 0) as number;
                const discAmt: number = (item.discountAmount ?? (unitPrice * qty * discPct / 100)) as number;
                const discountedPrice = discPct > 0 ? unitPrice * (1 - discPct / 100) : unitPrice;
                const lineAmt = qty * unitPrice - discAmt;
                return (
                  <View key={idx} style={{ flexDirection: "row", minHeight: 20 }}>
                    <Text style={{ width: "5%", padding: 3, textAlign: "center", borderRight: "1px solid #000", fontSize: 8 }}>{idx + 1}.</Text>
                    <Text style={{ width: "30%", padding: 3, textAlign: "left", borderRight: "1px solid #000", fontSize: 8 }}>{item.name ?? "N/A"}</Text>
                    <Text style={{ width: "11%", padding: 3, textAlign: "center", borderRight: "1px solid #000", fontSize: 8 }}>{getHSNCode(item.name ?? "")}</Text>
                    <Text style={{ width: "8%", padding: 3, textAlign: "right", borderRight: "1px solid #000", fontSize: 8 }}>{qty.toFixed(3)}</Text>
                    <Text style={{ width: "6%", padding: 3, textAlign: "center", borderRight: "1px solid #000", fontSize: 8 }}>Kgs.</Text>
                    <Text style={{ width: "9%", padding: 3, textAlign: "right", borderRight: "1px solid #000", fontSize: 8 }}>{unitPrice.toFixed(2)}</Text>
                    <Text style={{ width: "11%", padding: 3, textAlign: "center", borderRight: "1px solid #000", fontSize: 8 }}>{discPct} %</Text>
                    <Text style={{ width: "9%", padding: 3, textAlign: "right", borderRight: "1px solid #000", fontSize: 8 }}>{discountedPrice.toFixed(2)}</Text>
                    <Text style={{ width: "11%", padding: 3, textAlign: "right", fontSize: 8 }}>
                      {lineAmt.toFixed(2)}
                    </Text>
                  </View>
                );
              })}

              {/* Empty padding rows */}
              {Array.from({ length: emptyRows }).map((_, i) => (
                <View key={`e${i}`} style={{ flexDirection: "row", minHeight: 18 }}>
                  {["5%", "30%", "11%", "8%", "6%", "9%", "11%", "9%"].map((w, j) => (
                    <Text key={j} style={{ width: w, padding: 3, borderRight: "1px solid #000" }}> </Text>
                  ))}
                  <Text style={{ width: "11%", padding: 3 }}> </Text>
                </View>
              ))}

              {/* Totals */}
              <View style={{ flexDirection: "row", borderTop: "1px solid #000" }}>
                <Text style={{ flexGrow: 1, textAlign: "right", fontWeight: "bold", padding: 3, fontSize: 8 }}>Total</Text>
                <Text style={{ width: "11%", textAlign: "right", padding: 3, borderLeft: "1px solid #000", fontSize: 8 }}>
                  {totalAmt.toFixed(2)}
                </Text>
              </View>
              <View style={{ flexDirection: "row" }}>
                <Text style={{ flexGrow: 1, textAlign: "right", padding: 3, fontSize: 8 }}>Add : Rounded Off (+-)</Text>
                <Text style={{ width: "11%", textAlign: "right", padding: 3, borderLeft: "1px solid #000", fontSize: 8 }}>0.00</Text>
              </View>
            </View>

            {/* Grand Total */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 4, borderLeft: "1px solid #000", borderRight: "1px solid #000", borderBottom: "1px solid #000" }}>
              <Text style={{ fontWeight: "bold", fontSize: 10 }}>Grand Total</Text>
              <Text style={{ fontWeight: "bold", fontSize: 10 }}>{totalQuantity.toFixed(3)} Kgs.</Text>
              <Text style={{ fontWeight: "bold", fontSize: 12, width: "11%", textAlign: "right" }}>{totalAmt.toFixed(2)}</Text>
            </View>

            {/* Tax + Footer */}
            <View style={{ border: "1px solid #000", borderTop: "none" }}>
              <View style={{ flexDirection: "row", borderBottom: "1px solid #000" }}>
                <View style={{ flex: 3 }}>
                  {/* Tax table header */}
                  <View style={{ flexDirection: "row", borderBottom: "1px solid #000", fontWeight: "bold" }}>
                    {["Tax Rate", "Taxable Amt.", "CGST Amt.", "SGST Amt.", "Total Tax"].map((h, i, arr) => (
                      <Text key={h} style={{ padding: 3, flex: 1, textAlign: "center", borderRight: i < arr.length - 1 ? "1px solid #000" : undefined, fontSize: 8 }}>{h}</Text>
                    ))}
                  </View>
                  {/* Tax data row */}
                  <View style={{ flexDirection: "row" }}>
                    <Text style={{ padding: 3, flex: 1, textAlign: "left", borderRight: "1px solid #000", fontSize: 8 }}>5%</Text>
                    <Text style={{ padding: 3, flex: 1, textAlign: "right", borderRight: "1px solid #000", fontSize: 8 }}>{totals.taxableVal.toFixed(2)}</Text>
                    <Text style={{ padding: 3, flex: 1, textAlign: "right", borderRight: "1px solid #000", fontSize: 8 }}>{totals.cgst.toFixed(2)}</Text>
                    <Text style={{ padding: 3, flex: 1, textAlign: "right", borderRight: "1px solid #000", fontSize: 8 }}>{totals.sgst.toFixed(2)}</Text>
                    <Text style={{ padding: 3, flex: 1, textAlign: "right", fontSize: 8 }}>{totals.totalTax.toFixed(2)}</Text>
                  </View>
                  {/* Tax total row */}
                  <View style={{ flexDirection: "row", borderTop: "1px solid #000", fontWeight: "bold" }}>
                    <Text style={{ padding: 3, flex: 1, textAlign: "left", borderRight: "1px solid #000", fontSize: 8 }}>Total</Text>
                    <Text style={{ padding: 3, flex: 1, textAlign: "right", borderRight: "1px solid #000", fontSize: 8 }}>{totals.taxableVal.toFixed(2)}</Text>
                    <Text style={{ padding: 3, flex: 1, textAlign: "right", borderRight: "1px solid #000", fontSize: 8 }}>{totals.cgst.toFixed(2)}</Text>
                    <Text style={{ padding: 3, flex: 1, textAlign: "right", borderRight: "1px solid #000", fontSize: 8 }}>{totals.sgst.toFixed(2)}</Text>
                    <Text style={{ padding: 3, flex: 1, textAlign: "right", fontSize: 8 }}>{totals.totalTax.toFixed(2)}</Text>
                  </View>
                </View>
                <View style={{ flex: 1.5, borderLeft: "1px solid #000" }} />
              </View>

              {/* Amount in words */}
              <View style={{ padding: 4, borderBottom: "1px solid #000" }}>
                <Text style={{ fontWeight: "bold", fontSize: 10 }}>
                  Rupees {numberToWordsIndian(totalAmt)} Only
                </Text>
              </View>

              {/* Bank details */}
              <View style={{ padding: 4, borderBottom: "1px solid #000" }}>
                <Text style={{ fontWeight: "bold", fontSize: 9, marginBottom: 2 }}>Bank Details :</Text>
                <Text style={{ fontSize: 8 }}>AXIS BANK TEONTHA, KAITHAL  A/C NO. - 916020-021047-664</Text>
                <Text style={{ fontSize: 8 }}>IFSC CODE- UTIB0002465</Text>
              </View>

              {/* Footer: T&C + Signatures */}
              <View style={{ flexDirection: "row", minHeight: 60 }}>
                <View style={{ flex: 1.2, padding: 4, borderRight: "1px solid #000" }}>
                  <Text style={{ fontWeight: "bold", fontSize: 8, textDecoration: "underline", marginBottom: 2 }}>Terms & Conditions</Text>
                  <Text style={{ fontSize: 7, lineHeight: 1.2 }}>
                    {`E.&O.E.\n1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if the payment is not made within the stipulated time.\n3. Subject to Haryana Jurisdiction only.`}
                  </Text>
                </View>
                <View style={{ flex: 1, flexDirection: "column" }}>
                  <View style={{ minHeight: 30, borderBottom: "1px solid #000", padding: 4, justifyContent: "flex-end" }}>
                    <Text style={{ fontSize: 10 }}>Receiver's Signature :</Text>
                  </View>
                  <View style={{ padding: 4, textAlign: "center", flexGrow: 1, justifyContent: "flex-end" }}>
                    <Text style={{ fontWeight: "bold", fontSize: 10, marginBottom: 20 }}>For NANNU AGRO PRIVATE LIMITED</Text>
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
