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
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { useNotification } from "@refinedev/core";
import { pdf } from "@react-pdf/renderer";
import { OrderReportPDF } from "./components/OrderReportPDF";
import { ReturnsReportPDF } from "./components/ReturnsReportPDF";
import { LedgerReportPDF } from "./components/LedgerReportPDF";

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
  getPaymentDateForFilter,
  getPaymentOutletId,
  getPaymentMode,
  getPaymentRemarks,
  getPaymentStatus,
  filterPaymentsByOutlet,
  filterPaymentsByPaymentDateRange,
  filterOrdersByDateRange,
  filterReturnsByDateRange,
  getReturnAmount,
  getReturnDate,
  getReturnId,
  getReturnOutletId,
  getReturnStatus,
  getBalanceForOutlet,
  getPendingAmount,
  toYMD,
  addDays,
  parseYmd,
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

async function fetchPayments(
  start: string,
  end: string,
  outletId: string,
): Promise<RawPayment[]> {
  // API filters by createdAt; widen fetch then filter by paymentDate (matches order-admin).
  const apiStart = toYMD(addDays(parseYmd(start), -90));
  const apiEnd = toYMD(addDays(parseYmd(end), 30));
  const url = `${API_BASE_URL}/payments/report?startDate=${apiStart}&endDate=${apiEnd}&outletId=${encodeURIComponent(outletId)}`;
  const rows = await fetchAllPages(url);
  return filterPaymentsByPaymentDateRange(rows as RawPayment[], start, end);
}

async function fetchOrders(start: string, end: string, outletId: string): Promise<RawOrder[]> {
  const url = `${API_BASE_URL}/orders/report?startDate=${start}&endDate=${end}&outletId=${outletId}`;
  const rows = await fetchAllPages(url);
  return filterOrdersByDateRange(rows as RawOrder[], start, end);
}

async function fetchReturns(start: string, end: string, outletId: string): Promise<RawReturn[]> {
  const url = `${API_BASE_URL}/returns/report?startDate=${start}&endDate=${end}&outletId=${outletId}`;
  const rows = await fetchAllPages(url);
  return filterReturnsByDateRange(rows as RawReturn[], start, end);
}

// ── Item enrichment ───────────────────────────────────────────────
// The report endpoints return summary records without items[].
// Fetch individual order/return details to populate items for the PDF.

type AnyRecord = Record<string, unknown>;

async function enrichWithItems(
  records: AnyRecord[],
  endpoint: "orders" | "returns",
): Promise<AnyRecord[]> {
  return Promise.all(
    records.map(async (rec) => {
      if (Array.isArray(rec.items) && (rec.items as unknown[]).length > 0) return rec;
      const id = rec.id ?? rec["parent orderId"] ?? rec.returnId ?? rec.orderId;
      if (!id) return rec;
      try {
        const res = await fetch(`${API_BASE_URL}/${endpoint}/${String(id)}`, {
          headers: getApiHeaders(),
        });
        if (!res.ok) return rec;
        const body = await res.json() as AnyRecord;
        const detail: AnyRecord = (body?.data as AnyRecord) ?? body;
        return { ...rec, ...detail };
      } catch {
        return rec;
      }
    }),
  );
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

    const d = getPaymentDateForFilter(p);
    if (!d) continue;
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

// ── Open PDF blob in a new tab with proper blob URL ─────────────────

function openInReportWindow(win: Window, blob: Blob) {
  const blobUrl = URL.createObjectURL(blob);
  win.document.write(
    `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${blobUrl}"></head><body></body></html>`,
  );
  win.document.close();
}

// ── Report metadata ─────────────────────────────────────────────────

type ReportType = "ledger" | "orders" | "returns";

const REPORT_META: Record<ReportType, { title: string; dialogTitle: string; actionLabel: string }> = {
  ledger: {
    title: "Ledger Report",
    dialogTitle: "Ledger Report — Select Date Range",
    actionLabel: "Download PDF",
  },
  orders: {
    title: "Orders Report",
    dialogTitle: "Orders Report — Select Date Range",
    actionLabel: "Download PDF",
  },
  returns: {
    title: "Returns Report",
    dialogTitle: "Returns Report — Select Date Range",
    actionLabel: "Download PDF",
  },
};

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
  const [reportType, setReportType] = useState<ReportType>("ledger");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [loading, setLoading] = useState(false);

  const openDialog = (type: ReportType) => {
    setReportType(type);
    setDialogOpen(true);
  };

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

    // Open the window synchronously (while user gesture is still active)
    const reportWin = window.open("", "_blank");
    if (!reportWin) {
      notification.open?.({ type: "error", message: "Popup blocked. Please allow popups." });
      return;
    }

    setLoading(true);
    try {
      if (reportType === "orders") {
        const ordersRaw = await fetchOrders(startDate, endDate, outletId);
        const orders = await enrichWithItems(ordersRaw as AnyRecord[], "orders");
        const blob = await pdf(
          <OrderReportPDF reportData={orders} />,
        ).toBlob();
        openInReportWindow(reportWin, blob);
      } else if (reportType === "returns") {
        const returnsRaw = await fetchReturns(startDate, endDate, outletId);
        const returns = await enrichWithItems(returnsRaw as AnyRecord[], "returns");
        const blob = await pdf(
          <ReturnsReportPDF reportData={returns} />,
        ).toBlob();
        openInReportWindow(reportWin, blob);
      } else {
        // Ledger
        const dayBeforeStart = toYMD(addDays(new Date(startDate), -1));

        const [ordersRaw, paymentsRaw, returnsRaw, balanceRows] = await Promise.all([
          fetchOrders(startDate, endDate, outletId),
          fetchPayments(startDate, endDate, outletId),
          fetchReturns(startDate, endDate, outletId),
          fetchOpeningBalance(dayBeforeStart).catch(() => [] as RawBalanceRow[]),
        ]);

        const payments = filterPaymentsByOutlet(paymentsRaw, outletId);

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

        const blob = await pdf(
          <LedgerReportPDF
            entries={ledger}
            outletName={outletName}
            startDate={startDate}
            endDate={endDate}
            openingBalance={openingBalance}
          />,
        ).toBlob();
        openInReportWindow(reportWin, blob);
      }

      setDialogOpen(false);
    } catch (err) {
      console.error("Report generation error:", err);
      reportWin.close();
      notification.open?.({
        type: "error",
        message: "Failed to generate report",
        description: err instanceof Error ? err.message : "Check console for details.",
      });
    } finally {
      setLoading(false);
    }
  }, [reportType, startDate, endDate, outletId, notification]);

  const meta = REPORT_META[reportType];

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
        {/* Ledger Report */}
        <Card
          variant="outlined"
          sx={{
            cursor: "pointer",
            transition: "box-shadow 0.2s, border-color 0.2s",
            "&:hover": { borderColor: "primary.main", boxShadow: 2 },
          }}
          onClick={() => openDialog("ledger")}
        >
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <SummarizeOutlinedIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="h6" gutterBottom>
              Ledger Report
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Account ledger with orders, payments, returns &amp; opening balance for a date range.
            </Typography>
            <Button
              variant="contained"
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={(e) => {
                e.stopPropagation();
                openDialog("ledger");
              }}
            >
              Download PDF
            </Button>
          </CardContent>
        </Card>

        {/* Orders Report */}
        <Card
          variant="outlined"
          sx={{
            cursor: "pointer",
            transition: "box-shadow 0.2s, border-color 0.2s",
            "&:hover": { borderColor: "primary.main", boxShadow: 2 },
          }}
          onClick={() => openDialog("orders")}
        >
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <ReceiptLongOutlinedIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="h6" gutterBottom>
              Orders Report
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Tax invoices for all orders in a selected date range.
            </Typography>
            <Button
              variant="contained"
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={(e) => {
                e.stopPropagation();
                openDialog("orders");
              }}
            >
              Download PDF
            </Button>
          </CardContent>
        </Card>

        {/* Returns Report */}
        <Card
          variant="outlined"
          sx={{
            cursor: "pointer",
            transition: "box-shadow 0.2s, border-color 0.2s",
            "&:hover": { borderColor: "primary.main", boxShadow: 2 },
          }}
          onClick={() => openDialog("returns")}
        >
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <AssignmentReturnOutlinedIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="h6" gutterBottom>
              Returns Report
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Credit notes for all returns in a selected date range.
            </Typography>
            <Button
              variant="contained"
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={(e) => {
                e.stopPropagation();
                openDialog("returns");
              }}
            >
              Download PDF
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
        <DialogTitle>{meta.dialogTitle}</DialogTitle>
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
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <FileDownloadOutlinedIcon />}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? "Generating…" : meta.actionLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
