import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { LedgerEntry } from "../../../types/ledger";
import { formatINR, formatDateDDMMYYYY } from "../../../types/ledger";

export interface LedgerReportPDFProps {
  entries: LedgerEntry[];
  outletName: string;
  startDate: string;
  endDate: string;
  openingBalance: number;
}

const styles = StyleSheet.create({
  page: {
    padding: 15,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  container: {
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 0,
    paddingTop: 10,
    paddingBottom: 12,
  },
  header: {
    marginBottom: 10,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  companyName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  companyAddress: {
    fontSize: 9,
    marginBottom: 2,
  },
  gstin: {
    fontSize: 9,
    marginBottom: 10,
  },
  pageInfo: {
    fontSize: 10,
    marginBottom: 8,
    textAlign: "center",
    width: "100%",
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    textDecoration: "underline",
  },
  accountInfo: {
    fontSize: 10,
    marginBottom: 10,
    textAlign: "left",
    width: "100%",
  },
  dateRangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  openingBalanceText: {
    fontSize: 10,
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000",
    backgroundColor: "#f5f5f5",
  },
  tableHeaderCell: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRightWidth: 1,
    borderColor: "#000",
    fontWeight: "bold",
    fontSize: 9,
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    minHeight: 20,
  },
  tableCell: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRightWidth: 1,
    borderColor: "#000",
    fontSize: 9,
  },
  tableCellCenter: {
    textAlign: "center",
  },
  tableCellRight: {
    textAlign: "right",
  },
  accountCell: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRightWidth: 1,
    borderColor: "#000",
    fontSize: 9,
    flexWrap: "wrap",
    flexShrink: 0,
    alignItems: "flex-start",
  },
  narrationText: {
    fontSize: 7,
    color: "#666",
    marginTop: 2,
    paddingLeft: 2,
    lineHeight: 1.3,
    flexWrap: "wrap",
  },
  totalsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#000",
    backgroundColor: "#f9f9f9",
    fontWeight: "bold",
  },
  closingBalance: {
    marginTop: 8,
    fontSize: 10,
    textAlign: "right",
    paddingHorizontal: 10,
    fontWeight: "bold",
  },
  continuationText: {
    fontSize: 9,
    textAlign: "right",
    marginTop: 6,
    fontStyle: "italic",
    paddingHorizontal: 10,
  },
});

const colWidths = {
  date:      "10%",
  type:      "8%",
  vchBillNo: "12%",
  account:   "25%",
  debit:     "12%",
  credit:    "12%",
  balance:   "14%",
  narration: "7%",
};

const ROWS_PER_PAGE = 30;

export const LedgerReportPDF: React.FC<LedgerReportPDFProps> = ({
  entries,
  outletName,
  startDate,
  endDate,
  openingBalance,
}) => {
  const totalDebit  = entries.reduce((s, e) => s + e.debit,  0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  const closingBalance = lastEntry
    ? (lastEntry.balanceType === "Cr" ? -lastEntry.balance : lastEntry.balance)
    : openingBalance;

  const fmtStart = formatDateDDMMYYYY(new Date(startDate));
  const fmtEnd   = formatDateDDMMYYYY(new Date(endDate));

  if (entries.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.companyName}>NANNU AGRO PRIVATE LIMITED</Text>
              <Text style={styles.companyAddress}>Village Buchi, Pundri, Kaithal</Text>
              <Text style={styles.gstin}>GSTIN : 06AAECN2051P1ZB</Text>
              <Text style={styles.reportTitle}>Account Ledger</Text>
              <Text style={styles.accountInfo}>Account : {outletName}</Text>
            </View>
            <View style={styles.dateRangeRow}>
              <Text style={styles.openingBalanceText}>Date Range : {fmtStart} to {fmtEnd}</Text>
              <Text style={styles.openingBalanceText}>
                Opening Bal. = Rs. {formatINR(Math.abs(openingBalance))}{openingBalance >= 0 ? " Dr" : ""}
              </Text>
            </View>
            <View style={styles.table}>
              <View style={{ padding: 20, textAlign: "center" }}>
                <Text style={{ fontSize: 10, color: "#999" }}>No transaction data available for the selected period</Text>
              </View>
            </View>
          </View>
        </Page>
      </Document>
    );
  }

  const totalPages = Math.max(1, Math.ceil(entries.length / ROWS_PER_PAGE));
  const pages: React.ReactElement[] = [];

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const start       = pageIndex * ROWS_PER_PAGE;
    const end         = Math.min(start + ROWS_PER_PAGE, entries.length);
    const pageEntries = entries.slice(start, end);
    const isLastPage  = pageIndex === totalPages - 1;
    const isFirstPage = pageIndex === 0;

    const prevEntry            = start > 0 ? entries[start - 1] : null;
    const prevCumulativeDebit  = prevEntry ? prevEntry.cumulativeDebit  : 0;
    const prevCumulativeCredit = prevEntry ? prevEntry.cumulativeCredit : 0;
    const curCumulativeDebit   = end > 0 ? entries[end - 1].cumulativeDebit  : prevCumulativeDebit;
    const curCumulativeCredit  = end > 0 ? entries[end - 1].cumulativeCredit : prevCumulativeCredit;

    pages.push(
      <Page key={pageIndex} size="A4" style={styles.page}>
        <View style={styles.container}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.companyName}>NANNU AGRO PRIVATE LIMITED</Text>
            <Text style={styles.companyAddress}>Village Buchi, Pundri, Kaithal</Text>
            <Text style={styles.gstin}>GSTIN : 06AAECN2051P1ZB</Text>
            {isFirstPage ? (
              <>
                <Text style={styles.reportTitle}>Account Ledger</Text>
                <Text style={styles.accountInfo}>Account : {outletName}</Text>
              </>
            ) : (
              <Text style={styles.pageInfo}>
                Page {pageIndex + 1} ; Account Ledger : Account : {outletName} : From {fmtStart} to {fmtEnd}
              </Text>
            )}
          </View>

          {/* ── Date range + Opening balance (first page only) ── */}
          {isFirstPage && (
            <View style={styles.dateRangeRow}>
              <Text style={styles.openingBalanceText}>Date Range : {fmtStart} to {fmtEnd}</Text>
              <Text style={styles.openingBalanceText}>
                Opening Bal. = Rs. {formatINR(Math.abs(openingBalance))}{openingBalance >= 0 ? " Dr" : ""}
              </Text>
            </View>
          )}

          {/* ── Table ── */}
          <View style={styles.table}>

            {/* Table header row */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: colWidths.date }]}>Date</Text>
              <Text style={[styles.tableHeaderCell, { width: colWidths.type }]}>Type</Text>
              <Text style={[styles.tableHeaderCell, { width: colWidths.vchBillNo }]}>Vch/Bill No</Text>
              <Text style={[styles.tableHeaderCell, { width: colWidths.account }]}>Account</Text>
              <Text style={[styles.tableHeaderCell, { width: colWidths.debit }]}>Debit(Rs.)</Text>
              <Text style={[styles.tableHeaderCell, { width: colWidths.credit }]}>Credit(Rs.)</Text>
              <Text style={[styles.tableHeaderCell, { width: colWidths.balance }]}>Balance(Rs.)</Text>
              <Text style={[styles.tableHeaderCell, { width: colWidths.narration, borderRightWidth: 0 }]}>Short Narration</Text>
            </View>

            {/* Totals b/d (page 2+) */}
            {pageIndex > 0 && (
              <View style={styles.totalsRow}>
                <Text style={[styles.tableCell, { width: colWidths.date }]}>Totals b/d</Text>
                <Text style={[styles.tableCell, { width: colWidths.type }]}> </Text>
                <Text style={[styles.tableCell, { width: colWidths.vchBillNo }]}> </Text>
                <Text style={[styles.tableCell, { width: colWidths.account }]}> </Text>
                <Text style={[styles.tableCell, styles.tableCellRight, { width: colWidths.debit }]}>
                  {formatINR(prevCumulativeDebit)}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellRight, { width: colWidths.credit }]}>
                  {formatINR(prevCumulativeCredit)}
                </Text>
                <Text style={[styles.tableCell, { width: colWidths.balance }]}> </Text>
                <Text style={[styles.tableCell, { width: colWidths.narration, borderRightWidth: 0 }]}> </Text>
              </View>
            )}

            {/* Data rows */}
            {pageEntries.map((entry) => {
              const dateStr = entry.date ? formatDateDDMMYYYY(entry.date) : "---";
              const isFirstInGroup =
                entry.globalIndex === 0 ||
                formatDateDDMMYYYY(entries[entry.globalIndex - 1].date) !== dateStr;

              const hasLongNarration = entry.narration && entry.narration.length > 25;
              const rowMinHeight = hasLongNarration ? 40 : 20;

              return (
                <View key={entry.globalIndex} style={[styles.tableRow, { minHeight: rowMinHeight }]}>
                  <Text style={[styles.tableCell, styles.tableCellCenter, { width: colWidths.date }]}>
                    {isFirstInGroup ? dateStr : ""}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellCenter, { width: colWidths.type }]}>
                    {entry.type}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellCenter, { width: colWidths.vchBillNo }]}>
                    {entry.vchBillNo || ""}
                  </Text>
                  <View style={[styles.accountCell, { width: colWidths.account }]}>
                    <Text style={{ marginBottom: entry.narration ? 3 : 0 }}>{entry.account}</Text>
                    {entry.narration ? (
                      <Text style={styles.narrationText} wrap>{entry.narration}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.tableCell, styles.tableCellRight, { width: colWidths.debit }]}>
                    {entry.debit > 0 ? formatINR(entry.debit) : ""}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellRight, { width: colWidths.credit }]}>
                    {entry.credit > 0 ? formatINR(entry.credit) : ""}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellRight, { width: colWidths.balance }]}>
                    {formatINR(entry.balance)} {entry.balanceType}
                  </Text>
                  <Text style={[styles.tableCell, { width: colWidths.narration, borderRightWidth: 0 }]}> </Text>
                </View>
              );
            })}

            {/* Grand Total / Totals c/o */}
            <View style={styles.totalsRow}>
              <Text style={[styles.tableCell, { width: colWidths.date }]}>
                {isLastPage ? "Grand Total" : "Totals c/o"}
              </Text>
              <Text style={[styles.tableCell, { width: colWidths.type }]}> </Text>
              <Text style={[styles.tableCell, { width: colWidths.vchBillNo }]}> </Text>
              <Text style={[styles.tableCell, { width: colWidths.account }]}> </Text>
              <Text style={[styles.tableCell, styles.tableCellRight, { width: colWidths.debit }]}>
                {formatINR(isLastPage ? totalDebit : curCumulativeDebit)}
              </Text>
              <Text style={[styles.tableCell, styles.tableCellRight, { width: colWidths.credit }]}>
                {formatINR(isLastPage ? totalCredit : curCumulativeCredit)}
              </Text>
              <Text style={[styles.tableCell, { width: colWidths.balance }]}> </Text>
              <Text style={[styles.tableCell, { width: colWidths.narration, borderRightWidth: 0 }]}> </Text>
            </View>
          </View>

          {/* Closing balance / continuation */}
          {isLastPage ? (
            <Text style={styles.closingBalance}>
              Closing Bal. = Rs. {formatINR(Math.abs(closingBalance))}{closingBalance >= 0 ? " Dr" : ""}
            </Text>
          ) : (
            <Text style={styles.continuationText}>
              contd. on page {pageIndex + 2}...
            </Text>
          )}

        </View>
      </Page>,
    );
  }

  return <Document>{pages}</Document>;
};
