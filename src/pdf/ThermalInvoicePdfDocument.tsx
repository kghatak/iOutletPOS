import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { InvoiceData, InvoiceItem, ThermalPaperWidth } from "../types/thermalInvoice";
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

type ThermalTheme = {
  widthPt: number;
  widthMm: string;
  padding: number;
  companyName: number;
  companyAddress: number;
  phone: number;
  gstin: number;
  invoiceTitle: number;
  detail: number;
  headerCell: number;
  itemNumber: number;
  itemCell: number;
  itemName: number;
  totalLabel: number;
  totalValue: number;
  roundedLabel: number;
  roundedValue: number;
  grandQty: number;
  grandAmt: number;
  amountInWords: number;
  taxCell: number;
  taxCellBold: number;
  summaryLabel: number;
  summaryValue: number;
  footerText: number;
};

const theme4inch: ThermalTheme = {
  widthPt: 288,
  widthMm: "101.6mm",
  padding: 8,
  companyName: 10,
  companyAddress: 7,
  phone: 7,
  gstin: 8,
  invoiceTitle: 10,
  detail: 7,
  headerCell: 6,
  itemNumber: 7,
  itemCell: 7,
  itemName: 7,
  totalLabel: 8,
  totalValue: 8,
  roundedLabel: 7,
  roundedValue: 7,
  grandQty: 10,
  grandAmt: 10,
  amountInWords: 7,
  taxCell: 7,
  taxCellBold: 7,
  summaryLabel: 8,
  summaryValue: 8,
  footerText: 8,
};

/** 3″ roll ≈ 76.2mm × 216pt */
const theme3inch: ThermalTheme = {
  widthPt: 216,
  widthMm: "76.2mm",
  padding: 5,
  companyName: 9,
  companyAddress: 6,
  phone: 6,
  gstin: 7,
  invoiceTitle: 9,
  detail: 6,
  headerCell: 5,
  itemNumber: 6,
  itemCell: 6,
  itemName: 6,
  totalLabel: 7,
  totalValue: 7,
  roundedLabel: 6,
  roundedValue: 6,
  grandQty: 9,
  grandAmt: 9,
  amountInWords: 6,
  taxCell: 6,
  taxCellBold: 6,
  summaryLabel: 7,
  summaryValue: 7,
  footerText: 7,
};

function buildThermalStyles(t: ThermalTheme) {
  return StyleSheet.create({
    page: {
      flexDirection: "column",
      backgroundColor: "#ffffff",
      padding: t.padding,
      width: t.widthMm,
    },
    header: {
      marginBottom: 8,
      textAlign: "center",
    },
    companyName: {
      fontSize: t.companyName,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: 2,
    },
    companyAddress: {
      fontSize: t.companyAddress,
      textAlign: "center",
      marginBottom: 1,
    },
    phone: {
      fontSize: t.phone,
      textAlign: "center",
      marginBottom: 2,
    },
    gstin: {
      fontSize: t.gstin,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: 3,
    },
    invoiceTitle: {
      fontSize: t.invoiceTitle,
      fontWeight: "bold",
      textAlign: "center",
      borderTop: "1px solid #000",
      borderBottom: "1px solid #000",
      paddingVertical: 3,
      marginBottom: 5,
    },
    invoiceDetails: {
      marginBottom: 8,
    },
    detailRow: {
      flexDirection: "row",
      marginBottom: 2,
      paddingBottom: 2,
    },
    detailLabel: {
      fontSize: t.detail,
      fontWeight: "bold",
      width: "35%",
    },
    detailValue: {
      fontSize: t.detail,
      width: "65%",
    },
    tableHeader: {
      flexDirection: "row",
      borderTop: "1px solid #000",
      borderBottom: "1px solid #000",
      paddingVertical: 2,
      marginBottom: 0,
    },
    tableHeaderSecond: {
      flexDirection: "row",
      borderBottom: "1px solid #000",
      paddingVertical: 2,
      marginBottom: 5,
    },
    headerCell: {
      fontSize: t.headerCell,
      fontWeight: "bold",
      textAlign: "center",
      paddingHorizontal: 1,
    },
    itemRow: {
      marginBottom: 8,
    },
    itemFirstRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 1,
    },
    itemSecondRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 1,
    },
    itemNumber: {
      fontSize: t.itemNumber,
      width: "10%",
      textAlign: "center",
    },
    itemCell: {
      fontSize: t.itemCell,
      textAlign: "center",
      paddingHorizontal: 1,
    },
    itemName: {
      fontSize: t.itemName,
      textAlign: "left",
    },
    totalSection: {
      borderTop: "1px solid #000",
      paddingTop: 3,
      marginTop: 5,
    },
    totalRow: {
      flexDirection: "row",
      width: "100%",
      marginBottom: 2,
      alignItems: "center",
    },
    totalLabel: {
      fontSize: t.totalLabel,
      fontWeight: "bold",
      width: "52%",
    },
    totalValue: {
      fontSize: t.totalValue,
      fontWeight: "bold",
      width: "48%",
      textAlign: "right",
    },
    roundedRow: {
      flexDirection: "row",
      width: "100%",
      marginBottom: 3,
      alignItems: "center",
    },
    roundedLabel: {
      fontSize: t.roundedLabel,
      width: "52%",
    },
    roundedValue: {
      fontSize: t.roundedValue,
      width: "48%",
      textAlign: "right",
    },
    grandTotalRow: {
      flexDirection: "row",
      width: "100%",
      borderTop: "2px solid #000",
      borderBottom: "2px solid #000",
      paddingVertical: 4,
      marginVertical: 3,
      alignItems: "center",
    },
    grandTotalQuantity: {
      fontSize: t.grandQty,
      fontWeight: "bold",
      width: "48%",
    },
    grandTotalAmount: {
      fontSize: t.grandAmt,
      fontWeight: "bold",
      width: "52%",
      textAlign: "right",
    },
    amountInWords: {
      fontSize: t.amountInWords,
      fontStyle: "italic",
      textAlign: "center",
      marginBottom: 5,
      paddingBottom: 3,
    },
    taxBreakdown: {
      marginTop: 3,
    },
    taxHeaderRow: {
      flexDirection: "row",
      borderTop: "1px solid #000",
      borderBottom: "1px solid #000",
      paddingVertical: 2,
    },
    taxRow: {
      flexDirection: "row",
      borderBottom: "1px solid #000",
      paddingVertical: 1,
    },
    taxCell: {
      fontSize: t.taxCell,
      textAlign: "center",
      flex: 1,
      paddingHorizontal: 1,
    },
    taxCellBold: {
      fontSize: t.taxCellBold,
      textAlign: "center",
      fontWeight: "bold",
      flex: 1,
      paddingHorizontal: 1,
    },
    summarySection: {
      marginTop: 8,
    },
    summaryRow: {
      flexDirection: "row",
      width: "100%",
      marginBottom: 1,
      alignItems: "center",
    },
    summaryLabel: {
      fontSize: t.summaryLabel,
      fontWeight: "bold",
      width: "52%",
    },
    summaryValue: {
      fontSize: t.summaryValue,
      fontWeight: "bold",
      width: "48%",
      textAlign: "right",
    },
    footer: {
      marginTop: 8,
      textAlign: "center",
      borderTop: "1px solid #000",
      paddingTop: 5,
    },
    footerText: {
      fontSize: t.footerText,
      fontWeight: "bold",
    },
  });
}

const styles4inch = buildThermalStyles(theme4inch);
const styles3inch = buildThermalStyles(theme3inch);

function resolvePaperWidth(v: InvoiceData["paperWidth"]): ThermalPaperWidth {
  return v === "3inch" ? "3inch" : "4inch";
}

type Props = { data: InvoiceData };

export function ThermalInvoicePdfDocument({ data }: Props) {
  const paper = resolvePaperWidth(data.paperWidth);
  const styles = paper === "3inch" ? styles3inch : styles4inch;
  const pageWidthPt = paper === "3inch" ? theme3inch.widthPt : theme4inch.widthPt;

  const {
    invoiceNo,
    date,
    customerName,
    customerPhone,
    customerGst,
    customerAddress,
    items,
    subtotal,
    discount: totalDiscount,
    total,
    paymentMode,
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

  const calculateTotals = () => {
    let totalTaxableAt5 = 0;
    let totalExempt = 0;
    let totalGSTAmount = 0;
    let totalQuantity = 0;

    for (const item of items) {
      const finalItemAmount = item.lineTotal;
      totalQuantity += item.quantity;
      const gst = item.gst ?? 0;
      if (gst > 0) {
        const taxableAmount = finalItemAmount / (1 + gst / 100);
        const itemTax = taxableAmount * (gst / 100);
        totalTaxableAt5 += taxableAmount;
        totalGSTAmount += itemTax;
      } else {
        totalExempt += finalItemAmount;
      }
    }

    const totalCGST = totalGSTAmount / 2;
    const totalSGST = totalGSTAmount / 2;

    return {
      totalTaxableAt5,
      totalExempt,
      totalCGST,
      totalSGST,
      totalGSTAmount,
      totalQuantity,
    };
  };

  const totals = calculateTotals();

  return (
    <Document>
      <Page size={[pageWidthPt, 2000]} style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>NANNU AGRO PRIVATE LIMITED</Text>
          <Text style={styles.companyAddress}>Village Buchi, Pundri, Kaithal</Text>
          <Text style={styles.phone}>Phone: 98127-12739, 92559-19666</Text>
          <Text style={styles.gstin}>GSTIN: 06AAECN2051P1ZB</Text>
        </View>

        <Text style={styles.invoiceTitle}>TAX INVOICE</Text>

        <View style={styles.invoiceDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Invoice No/Date:</Text>
            <Text style={styles.detailValue}>
              {invoiceNo} / {date}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Customer Name:</Text>
            <Text style={styles.detailValue}>{customerName?.trim() || "—"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Address:</Text>
            <Text style={styles.detailValue}>{customerAddress?.trim() || "—"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cust Mobile No:</Text>
            <Text style={styles.detailValue}>{customerPhone?.trim() || "—"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>GSTIN / UIN:</Text>
            <Text style={styles.detailValue}>{customerGst?.trim() || "--"}</Text>
          </View>
          {paymentMode ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment:</Text>
              <Text style={styles.detailValue}>{paymentMode}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, { width: "10%" }]}>Sl</Text>
          <Text style={[styles.headerCell, { width: "35%" }]}>Product</Text>
          <Text style={[styles.headerCell, { width: "15%" }]}>Price</Text>
          <Text style={[styles.headerCell, { width: "15%" }]}>Disc(%)</Text>
          <Text style={[styles.headerCell, { width: "25%" }]}>Amt.</Text>
        </View>

        <View style={styles.tableHeaderSecond}>
          <Text style={[styles.headerCell, { width: "10%" }]} />
          <Text style={[styles.headerCell, { width: "15%" }]}>Qty.</Text>
          <Text style={[styles.headerCell, { width: "20%" }]}>HSN Code</Text>
          <Text style={[styles.headerCell, { width: "15%" }]}>GST %</Text>
          <Text style={[styles.headerCell, { width: "25%" }]}>GST Amt</Text>
        </View>

        {items.map((item, index) => {
          const discountPercentage = item.discountPercentage ?? 0;
          const finalItemAmount = item.lineTotal;
          const gst = item.gst ?? 0;
          const gstAmount =
            gst > 0
              ? (finalItemAmount / (1 + gst / 100)) * (gst / 100)
              : 0;
          return (
            <View key={`${item.name}-${index}`} style={styles.itemRow}>
              <View style={styles.itemFirstRow}>
                <Text style={[styles.itemNumber, { width: "10%" }]}>{index + 1}</Text>
                <Text style={[styles.itemName, { width: "35%" }]}>{item.name}</Text>
                <Text style={[styles.itemCell, { width: "15%" }]}>
                  {(item.unitPrice || 0).toFixed(2)}
                </Text>
                <Text style={[styles.itemCell, { width: "15%" }]}>
                  {discountPercentage.toFixed(2)} %
                </Text>
                <Text style={[styles.itemCell, { width: "25%" }]}>
                  {finalItemAmount.toFixed(2)}
                </Text>
              </View>
              <View style={styles.itemSecondRow}>
                <Text style={[styles.itemNumber, { width: "10%" }]} />
                <Text style={[styles.itemCell, { width: "15%" }]}>{item.quantity || 0}</Text>
                <Text style={[styles.itemCell, { width: "20%" }]}>{getHSNCode(item)}</Text>
                <Text style={[styles.itemCell, { width: "15%" }]}>
                  {gst > 0 ? "5%" : "Exempt"}
                </Text>
                <Text style={[styles.itemCell, { width: "25%" }]}>{gstAmount.toFixed(2)}</Text>
              </View>
            </View>
          );
        })}

        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total (before discount)</Text>
            <Text style={styles.totalValue}>{fmtInrPdf(displaySubtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount (-)</Text>
            <Text style={styles.totalValue}>
              {discountAmt > 0 ? `-${fmtInrPdf(discountAmt)}` : fmtInrPdf(0)}
            </Text>
          </View>
          <View style={styles.roundedRow}>
            <Text style={styles.roundedLabel}>Add: Rounded Off (+)</Text>
            <Text style={styles.roundedValue}>0.00</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalQuantity}>{totals.totalQuantity.toFixed(3)}</Text>
            <Text style={styles.grandTotalAmount}>{fmtInrPdf(netPayable)}</Text>
          </View>
        </View>

        <Text style={styles.amountInWords}>
          Rupees {numberToWordsIndian(netPayable)} Only
        </Text>

        <View style={styles.taxBreakdown}>
          <View style={styles.taxHeaderRow}>
            <Text style={styles.taxCellBold}>Tax Rate</Text>
            <Text style={styles.taxCellBold}>Taxable Amt.</Text>
            <Text style={styles.taxCellBold}>CGST Amt.</Text>
            <Text style={styles.taxCellBold}>SGST Amt.</Text>
          </View>

          {totals.totalTaxableAt5 > 0 ? (
            <View style={styles.taxRow}>
              <Text style={styles.taxCell}>5%</Text>
              <Text style={styles.taxCell}>{totals.totalTaxableAt5.toFixed(2)}</Text>
              <Text style={styles.taxCell}>{totals.totalCGST.toFixed(2)}</Text>
              <Text style={styles.taxCell}>{totals.totalSGST.toFixed(2)}</Text>
            </View>
          ) : null}

          {totals.totalExempt > 0 ? (
            <View style={styles.taxRow}>
              <Text style={styles.taxCell}>Exempt</Text>
              <Text style={styles.taxCell}>{totals.totalExempt.toFixed(2)}</Text>
              <Text style={styles.taxCell}>--</Text>
              <Text style={styles.taxCell}>--</Text>
            </View>
          ) : null}

          <View style={styles.taxHeaderRow}>
            <Text style={styles.taxCellBold}>Total</Text>
            <Text style={styles.taxCellBold}>
              {(totals.totalTaxableAt5 + totals.totalExempt).toFixed(2)}
            </Text>
            <Text style={styles.taxCellBold}>{totals.totalCGST.toFixed(2)}</Text>
            <Text style={styles.taxCellBold}>{totals.totalSGST.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total GST :</Text>
            <Text style={styles.summaryValue}>{totals.totalGSTAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Sale :</Text>
            <Text style={styles.summaryValue}>{fmtInrPdf(netPayable)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Savings :</Text>
            <Text style={styles.summaryValue}>{fmtInrPdf(discountAmt)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Net Payable :</Text>
            <Text style={styles.summaryValue}>{fmtInrPdf(netPayable)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>THANK YOU. VISIT US AGAIN.</Text>
        </View>
      </Page>
    </Document>
  );
}
