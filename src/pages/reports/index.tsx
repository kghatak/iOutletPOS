import { useCallback, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PrintIcon from "@mui/icons-material/Print";
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import { useNotification } from "@refinedev/core";

import { API_BASE_URL, AUTH_STORAGE_KEY } from "../../config";
import { getApiHeaders } from "../../providers/authProvider";
import { useOutlet } from "../../context/outlet-context";
import type {
  LedgerEntry,
  RawOrder,
  RawPayment,
  RawReturn,
  RawBalanceRow,
  PendingOutletRow,
} from "../../types/ledger";
import {
  getOrderAmount,
  getOrderDate,
  getOrderSortDate,
  getOrderId,
  getOrderOutletId,
  getOrderAccount,
  getPaymentAmount,
  getPaymentDate,
  getPaymentOutletId,
  getPaymentMode,
  getPaymentRemarks,
  getPaymentStatus,
  getReturnAmount,
  getReturnDate,
  getReturnId,
  getReturnOutletId,
  getReturnStatus,
  getBalanceForOutlet,
  getPendingAmount,
  formatINR,
  formatDateDDMMYYYY,
  toYMD,
  addDays,
} from "../../types/ledger";

// ── Session helper ─────────────────────────────────────────────────

function getOutletName(): string {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return "";
    const s = JSON.parse(raw) as { name?: string };
    return s.name ?? "";
  } catch {
    return "";
  }
}

// ── API helpers ────────────────────────────────────────────────────

function unwrapArray(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    for (const k of ["data", "items", "results", "records", "rows"]) {
      if (Array.isArray(o[k])) return o[k] as unknown[];
    }
  }
  return [];
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: getApiHeaders() });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchAllPages(baseUrl: string, limit = 50): Promise<unknown[]> {
  let page = 1;
  const all: unknown[] = [];
  const sep = baseUrl.includes("?") ? "&" : "?";
  for (;;) {
    const url = `${baseUrl}${sep}page=${page}&limit=${limit}`;
    const body = await fetchJson(url);
    const rows = unwrapArray(body);
    all.push(...rows);
    if (rows.length < limit) break;
    page += 1;
    if (page > 200) break;
  }
  return all;
}

async function fetchPayments(start: string, end: string): Promise<RawPayment[]> {
  const url = `${API_BASE_URL}/payments/report?startDate=${start}&endDate=${end}`;
  const body = await fetchJson(url);
  return unwrapArray(body) as RawPayment[];
}

async function fetchOrders(start: string, end: string, outletId: string): Promise<RawOrder[]> {
  const url = `${API_BASE_URL}/orders/report?startDate=${start}&endDate=${end}&outletId=${outletId}`;
  const rows = await fetchAllPages(url);
  return rows as RawOrder[];
}

async function fetchReturns(start: string, end: string, outletId: string): Promise<RawReturn[]> {
  const url = `${API_BASE_URL}/returns/report?startDate=${start}&endDate=${end}&outletId=${outletId}`;
  const body = await fetchJson(url);
  return unwrapArray(body) as RawReturn[];
}

async function fetchOpeningBalance(date: string): Promise<RawBalanceRow[]> {
  const url = `${API_BASE_URL}/outletopeningclosingbalance?date=${date}`;
  const body = await fetchJson(url);
  return unwrapArray(body) as RawBalanceRow[];
}

async function fetchPendingBalance(outletId: string): Promise<number> {
  const url = `${API_BASE_URL}/payments/pending-outlets/${outletId}`;
  const body = await fetchJson(url);
  if (typeof body === "number") return body;
  if (body && typeof body === "object") {
    return getPendingAmount(body as PendingOutletRow);
  }
  return 0;
}

// ── Ledger assembly (matches order-admin createLedgerPages) ────────

interface AssembleOpts {
  orders: RawOrder[];
  payments: RawPayment[];
  returns: RawReturn[];
  openingBalance: number;
  outletId: string;
}

function assembleLedger(opts: AssembleOpts): LedgerEntry[] {
  const { orders, payments, returns, openingBalance, outletId } = opts;
  const entries: Omit<LedgerEntry, "balance" | "balanceType" | "cumulativeDebit" | "cumulativeCredit" | "globalIndex">[] = [];

  // Orders → Sale (debit)
  for (const o of orders) {
    if (outletId && getOrderOutletId(o) && getOrderOutletId(o) !== outletId) continue;
    const amt = getOrderAmount(o);
    if (amt <= 0) continue;
    entries.push({
      date: getOrderDate(o),
      sortDate: getOrderSortDate(o),
      type: "Sale",
      vchBillNo: getOrderId(o),
      account: getOrderAccount(o),
      debit: amt,
      credit: 0,
      narration: "",
    });
  }

  // Returns → SIRt (credit)
  for (const r of returns) {
    if (outletId && getReturnOutletId(r) && getReturnOutletId(r) !== outletId) continue;
    if (getReturnStatus(r) === "cancelled") continue;
    const amt = getReturnAmount(r);
    if (amt <= 0) continue;
    const d = getReturnDate(r);
    entries.push({
      date: d,
      sortDate: d,
      type: "SIRt",
      vchBillNo: getReturnId(r),
      account: "Sales Return",
      debit: 0,
      credit: amt,
      narration: "",
    });
  }

  // Payments → Rcpt (credit), grouped by date + payment mode
  const groups: Record<string, {
    date: Date;
    totalAmount: number;
    mode: string;
    narrations: string[];
  }> = {};

  for (const p of payments) {
    if (outletId && getPaymentOutletId(p) && getPaymentOutletId(p) !== outletId) continue;
    if (getPaymentStatus(p) !== "approved") continue;
    const amt = getPaymentAmount(p);
    if (amt <= 0) continue;

    const d = getPaymentDate(p);
    const mode = getPaymentMode(p);
    const dateKey = toYMD(d);
    const groupKey = `${dateKey}_${mode}`;

    if (!groups[groupKey]) {
      groups[groupKey] = { date: d, totalAmount: 0, mode, narrations: [] };
    }
    groups[groupKey].totalAmount += amt;

    const remarks = getPaymentRemarks(p);
    if (remarks) {
      if (!groups[groupKey].narrations.includes(remarks)) {
        groups[groupKey].narrations.push(remarks);
      }
    } else if (groups[groupKey].narrations.length === 0) {
      const lower = mode.toLowerCase();
      let def = `Being Amount Received ${mode}`;
      if (lower === "cash") def = "Being Amount Received In Cash By Driver";
      else if (lower === "online" || lower === "upi") def = "Being Amount Received By Online";
      groups[groupKey].narrations.push(def);
    }
  }

  for (const g of Object.values(groups)) {
    entries.push({
      date: g.date,
      sortDate: g.date,
      type: "Rcpt",
      vchBillNo: "",
      account: g.mode,
      debit: 0,
      credit: g.totalAmount,
      narration: g.narrations.join("; "),
    });
  }

  // Sort chronologically
  entries.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

  // Running balance + cumulative totals
  let runningBalance = openingBalance;
  let cumDebit = 0;
  let cumCredit = 0;

  return entries.map((e, i) => {
    runningBalance = runningBalance + e.debit - e.credit;
    cumDebit += e.debit;
    cumCredit += e.credit;
    return {
      ...e,
      balance: Math.abs(runningBalance),
      balanceType: (runningBalance >= 0 ? "Dr" : "Cr") as "Dr" | "Cr",
      cumulativeDebit: cumDebit,
      cumulativeCredit: cumCredit,
      globalIndex: i,
    };
  });
}

// ── HTML PDF generation (matches order-admin layout pixel-for-pixel) ─

const ROWS_PER_PAGE = 30;

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildLedgerHTML(
  entries: LedgerEntry[],
  opts: {
    outletName: string;
    startDate: string;
    endDate: string;
    openingBalance: number;
  },
): string {
  const { outletName, startDate, endDate, openingBalance } = opts;

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const closingBalance = entries.length > 0
    ? (entries[entries.length - 1].balanceType === "Cr" ? -entries[entries.length - 1].balance : entries[entries.length - 1].balance)
    : openingBalance;

  const fmtStart = formatDateDDMMYYYY(new Date(startDate));
  const fmtEnd = formatDateDDMMYYYY(new Date(endDate));
  const obSuffix = openingBalance >= 0 ? " Dr" : "";
  const cbSuffix = closingBalance >= 0 ? " Dr" : "";

  const totalPages = Math.max(1, Math.ceil(entries.length / ROWS_PER_PAGE));
  const pages: string[] = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const start = pageIdx * ROWS_PER_PAGE;
    const end = Math.min(start + ROWS_PER_PAGE, entries.length);
    const pageEntries = entries.slice(start, end);
    const isLastPage = pageIdx === totalPages - 1;
    const isFirstPage = pageIdx === 0;

    const prevEntry = start > 0 ? entries[start - 1] : null;
    const prevCumDebit = prevEntry ? prevEntry.cumulativeDebit : 0;
    const prevCumCredit = prevEntry ? prevEntry.cumulativeCredit : 0;
    const curCumDebit = end > 0 ? entries[end - 1].cumulativeDebit : prevCumDebit;
    const curCumCredit = end > 0 ? entries[end - 1].cumulativeCredit : prevCumCredit;

    // Header
    let headerHTML: string;
    if (isFirstPage) {
      headerHTML = `
        <div class="header">
          <div class="company">NANNU AGRO PRIVATE LIMITED</div>
          <div class="sub">Village Buchi, Pundri, Kaithal</div>
          <div class="sub">GSTIN : 06AAECN2051P1ZB</div>
          <div class="title">Account Ledger</div>
          <div class="account">Account : ${escHtml(outletName)}</div>
        </div>
        <div class="meta-row">
          <span>Date Range : ${fmtStart} to ${fmtEnd}</span>
          <span>Opening Bal. = Rs. ${formatINR(Math.abs(openingBalance))}${obSuffix}</span>
        </div>`;
    } else {
      headerHTML = `
        <div class="header">
          <div class="company">NANNU AGRO PRIVATE LIMITED</div>
          <div class="sub">Village Buchi, Pundri, Kaithal</div>
          <div class="sub">GSTIN : 06AAECN2051P1ZB</div>
          <div class="page-info">Page ${pageIdx + 1} ; Account Ledger : Account : ${escHtml(outletName)} : From ${fmtStart} to ${fmtEnd}</div>
        </div>`;
    }

    // Table header
    const tableHeaderHTML = `
      <tr class="th-row">
        <th style="width:10%">Date</th>
        <th style="width:8%">Type</th>
        <th style="width:12%">Vch/Bill No</th>
        <th style="width:25%">Account</th>
        <th style="width:12%">Debit(Rs.)</th>
        <th style="width:12%">Credit(Rs.)</th>
        <th style="width:14%">Balance(Rs.)</th>
        <th style="width:10%">Short Narration</th>
      </tr>`;

    // Totals b/d row (page 2+)
    let bfRow = "";
    if (pageIdx > 0) {
      bfRow = `
      <tr class="totals-row">
        <td class="bold">Totals b/d</td>
        <td></td><td></td><td></td>
        <td class="r">${formatINR(prevCumDebit)}</td>
        <td class="r">${formatINR(prevCumCredit)}</td>
        <td></td><td></td>
      </tr>`;
    }

    // Data rows
    let prevDateStr = "";
    const dataRows = pageEntries.map((e) => {
      const dateStr = formatDateDDMMYYYY(e.date);
      const isFirstInGroup =
        e.globalIndex === 0 ||
        formatDateDDMMYYYY(entries[e.globalIndex - 1].date) !== dateStr;
      const showDate = isFirstInGroup && dateStr !== prevDateStr;
      if (showDate) prevDateStr = dateStr;

      const accountCell = e.narration
        ? `<div>${escHtml(e.account)}</div><div class="narration">${escHtml(e.narration)}</div>`
        : escHtml(e.account);

      return `
      <tr>
        <td class="c">${showDate ? dateStr : ""}</td>
        <td class="c">${e.type}</td>
        <td class="c">${escHtml(e.vchBillNo)}</td>
        <td class="account-cell">${accountCell}</td>
        <td class="r">${e.debit > 0 ? formatINR(e.debit) : ""}</td>
        <td class="r">${e.credit > 0 ? formatINR(e.credit) : ""}</td>
        <td class="r">${formatINR(e.balance)} ${e.balanceType}</td>
        <td></td>
      </tr>`;
    }).join("\n");

    // Footer row
    let footerRow: string;
    if (isLastPage) {
      footerRow = `
      <tr class="totals-row">
        <td class="bold">Grand Total</td>
        <td></td><td></td><td></td>
        <td class="r bold">${formatINR(totalDebit)}</td>
        <td class="r bold">${formatINR(totalCredit)}</td>
        <td></td><td></td>
      </tr>`;
    } else {
      footerRow = `
      <tr class="totals-row">
        <td class="bold">Totals c/o</td>
        <td></td><td></td><td></td>
        <td class="r">${formatINR(curCumDebit)}</td>
        <td class="r">${formatINR(curCumCredit)}</td>
        <td></td><td></td>
      </tr>`;
    }

    // Closing balance (only last page)
    const closingHTML = isLastPage
      ? `<div class="closing">Closing Bal. = Rs. ${formatINR(Math.abs(closingBalance))}${cbSuffix}</div>`
      : `<div class="continuation">contd. on page ${pageIdx + 2}...</div>`;

    pages.push(`
    <div class="page-container${pageIdx > 0 ? " page-break" : ""}">
      <div class="border-box">
        ${headerHTML}
        <table>
          <thead>${tableHeaderHTML}</thead>
          <tbody>
            ${bfRow}
            ${dataRows}
            ${footerRow}
          </tbody>
        </table>
        ${closingHTML}
      </div>
    </div>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Account Ledger – ${escHtml(outletName)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 10px; color: #000; }

  .page-break { page-break-before: always; }
  .page-container { padding: 5px; }
  .border-box { border: 1px solid #000; padding: 10px 0 12px; }

  .header { text-align: center; padding: 0 10px 6px; }
  .header .company { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
  .header .sub { font-size: 9px; margin-bottom: 2px; }
  .header .title { font-size: 14px; font-weight: bold; text-decoration: underline; margin: 10px 0 8px; }
  .header .account { font-size: 10px; text-align: left; margin-bottom: 10px; }
  .header .page-info { font-size: 10px; margin: 8px 0; }

  .meta-row { display: flex; justify-content: space-between; padding: 0 10px; margin-bottom: 8px; font-size: 10px; }

  table { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  th, td { border-right: 1px solid #000; padding: 4px 2px; font-size: 9px; vertical-align: top; }
  th:last-child, td:last-child { border-right: none; }
  .th-row { background: #f5f5f5; }
  th { font-weight: bold; text-align: center; padding: 4px 2px; }

  td.c { text-align: center; }
  td.r { text-align: right; padding-right: 4px; }
  td.bold, .bold { font-weight: bold; }

  .account-cell { padding: 4px 2px; }
  .account-cell .narration { font-size: 7px; color: #666; margin-top: 2px; padding-left: 2px; line-height: 1.3; }

  .totals-row { border-top: 1px solid #000; background: #f9f9f9; }
  .totals-row td { font-weight: bold; }

  .closing { margin-top: 8px; font-size: 10px; font-weight: bold; text-align: right; padding-right: 10px; }
  .continuation { margin-top: 6px; font-size: 9px; font-style: italic; text-align: right; padding-right: 10px; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-break { page-break-before: always; }
  }
</style>
</head>
<body>
${pages.join("\n")}
<script>window.onload=function(){window.print();}<\/script>
</body>
</html>`;
}

function openPrintWindow(html: string) {
  const win = window.open("", "_blank");
  if (!win) {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    return;
  }
  win.document.write(html);
  win.document.close();
}

// ── Component ──────────────────────────────────────────────────────

function defaultStart(): string {
  const d = new Date();
  d.setDate(1);
  return toYMD(d);
}

function defaultEnd(): string {
  return toYMD(new Date());
}

export const ReportsPage = () => {
  const { outletId } = useOutlet();
  const notification = useNotification();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!startDate || !endDate) {
      notification.open?.({ type: "error", message: "Select both dates" });
      return;
    }
    if (startDate > endDate) {
      notification.open?.({ type: "error", message: "Start date must be before end date" });
      return;
    }
    if (!outletId) {
      notification.open?.({
        type: "error",
        message: "Outlet not found",
        description: "Please log in again.",
      });
      return;
    }

    setLoading(true);
    try {
      const dayBeforeStart = toYMD(addDays(new Date(startDate), -1));

      const [ordersRaw, paymentsRaw, returnsRaw, balanceRows] = await Promise.all([
        fetchOrders(startDate, endDate, outletId),
        fetchPayments(startDate, endDate),
        fetchReturns(startDate, endDate, outletId),
        fetchOpeningBalance(dayBeforeStart).catch(() => [] as RawBalanceRow[]),
      ]);

      const payments = paymentsRaw.filter(
        (p) => !getPaymentOutletId(p) || getPaymentOutletId(p) === outletId,
      );

      let openingBalance = getBalanceForOutlet(balanceRows, outletId);
      if (openingBalance === null) {
        try {
          openingBalance = await fetchPendingBalance(outletId);
        } catch {
          openingBalance = 0;
        }
      }

      const ledger = assembleLedger({
        orders: ordersRaw,
        payments,
        returns: returnsRaw,
        openingBalance,
        outletId,
      });

      const outletName = getOutletName() || `Outlet ${outletId}`;

      const html = buildLedgerHTML(ledger, {
        outletName,
        startDate,
        endDate,
        openingBalance,
      });

      openPrintWindow(html);

      notification.open?.({
        type: "success",
        message: "Ledger report generated",
        description: `${ledger.length} entries for ${startDate} to ${endDate}`,
      });
      setDialogOpen(false);
    } catch (err) {
      console.error("Ledger generation error:", err);
      notification.open?.({
        type: "error",
        message: "Failed to generate ledger",
        description: err instanceof Error ? err.message : "Check console for details.",
      });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, outletId, notification]);

  return (
    <>
      <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
        Reports
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
          },
          gap: 2,
        }}
      >
        <Card
          variant="outlined"
          sx={{
            cursor: "pointer",
            transition: "box-shadow 0.2s, border-color 0.2s",
            "&:hover": { borderColor: "primary.main", boxShadow: 2 },
          }}
          onClick={() => setDialogOpen(true)}
        >
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <SummarizeOutlinedIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="h6" gutterBottom>
              Ledger Report
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Account ledger with orders, payments, returns &amp; opening
              balance for a date range.
            </Typography>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={(e) => {
                e.stopPropagation();
                setDialogOpen(true);
              }}
            >
              Download / Print
            </Button>
          </CardContent>
        </Card>
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={() => !loading && setDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Ledger Report — Select Date Range</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              fullWidth
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              fullWidth
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PrintIcon />}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? "Generating…" : "Generate & Print"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
