import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { Link } from "react-router";
import { useList } from "@refinedev/core";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import type { SaleRecord } from "../../types/sale";
import {
  getSaleAmountNumber,
  getSaleBillerName,
  getSaleOrderDiscount,
  getSalePaymentMode,
  getSaleRecordLocalDateKey,
} from "../../types/sale";

const SALES_LIST_CAP = 2000;
const MAX_RANGE_DAYS = 7;
const MAX_GAP_DAYS = MAX_RANGE_DAYS - 1;

type PaymentBucket =
  | "notPaid"
  | "cash"
  | "card"
  | "duePayment"
  | "other"
  | "wallet"
  | "upi"
  | "onlinePaid"
  | "onlineCod";

const PAYMENT_ROWS: { id: PaymentBucket; label: string }[] = [
  { id: "notPaid", label: "Not Paid" },
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card" },
  { id: "duePayment", label: "Due Payment" },
  { id: "other", label: "Other" },
  { id: "wallet", label: "Wallet" },
  { id: "upi", label: "UPI" },
  { id: "onlinePaid", label: "Online Paid" },
  { id: "onlineCod", label: "Online COD" },
];

function emptyPaymentMap(): Record<PaymentBucket, number> {
  return {
    notPaid: 0,
    cash: 0,
    card: 0,
    duePayment: 0,
    other: 0,
    wallet: 0,
    upi: 0,
    onlinePaid: 0,
    onlineCod: 0,
  };
}

function getTodayDateInputValue(): string {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

function isYyyyMmDd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

function parseLocalDateAtNoon(isoDay: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay.trim());
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

function formatLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function addCalendarDaysISO(isoDay: string, deltaDays: number): string {
  const d = parseLocalDateAtNoon(isoDay);
  if (Number.isNaN(d.getTime())) return isoDay;
  d.setDate(d.getDate() + deltaDays);
  return formatLocalYMD(d);
}

function normalizedDateRange(from: string, to: string): { start: string; end: string } | null {
  const f = from.trim();
  const t = to.trim();
  if (!f && !t) return null;
  if (f && !t) return { start: f, end: f };
  if (!f && t) return { start: t, end: t };
  if (!f || !t) return null;
  return f <= t ? { start: f, end: t } : { start: t, end: f };
}

function inclusiveCalendarDayCount(start: string, end: string): number {
  const a = parseLocalDateAtNoon(start);
  const b = parseLocalDateAtNoon(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return NaN;
  const diff = Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
  return diff + 1;
}

function formatDdMmYyyy(isoDay: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay.trim());
  if (!m) return isoDay;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function formatReportTitleRange(start: string, end: string): string {
  if (start === end) return formatDdMmYyyy(start);
  return `${formatDdMmYyyy(start)} → ${formatDdMmYyyy(end)}`;
}

function paymentBucket(mode: string | undefined): PaymentBucket {
  const m = (mode ?? "").trim().toLowerCase();
  if (!m) return "notPaid";
  if (m === "cash") return "cash";
  if (m === "card") return "card";
  if (m === "due" || m.includes("due")) return "duePayment";
  if (m === "upi") return "upi";
  if (m.includes("wallet")) return "wallet";
  if (m.includes("online") && m.includes("cod")) return "onlineCod";
  if (m.includes("online")) return "onlinePaid";
  return "other";
}

function saleOrderDiscountAmount(record: SaleRecord): number {
  const d = getSaleOrderDiscount(record);
  if (d == null) return 0;
  if (typeof d === "number") return d > 0 ? d : 0;
  const a = d.amount;
  return typeof a === "number" && Number.isFinite(a) && a > 0 ? a : 0;
}

function isSaleCancelled(record: SaleRecord): boolean {
  const o = record as Record<string, unknown>;
  if (o.cancelled === true || o.isCancelled === true || o.Canceled === true) return true;
  const st = String(o.status ?? o.Status ?? "").trim().toLowerCase();
  return st === "cancelled" || st === "canceled" || st === "void" || st === "refunded";
}

function hasTruthyFlag(record: SaleRecord, ...keys: string[]): boolean {
  const o = record as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (v === true || v === 1) return true;
    const s = String(v ?? "").trim().toLowerCase();
    if (s === "true" || s === "yes" || s === "1") return true;
  }
  return false;
}

type BillerBlock = {
  name: string;
  ordersPunched: number;
  ordersSuccess: number;
  ordersCancelled: number;
  ordersDiscounted: number;
  ordersModified: number;
  ordersReprinted: number;
  payments: Record<PaymentBucket, number>;
  subTotal: number;
};

function aggregateByBiller(records: SaleRecord[]): BillerBlock[] {
  const map = new Map<string, BillerBlock>();

  for (const r of records) {
    const name = getSaleBillerName(r);
    const amt = getSaleAmountNumber(r);
    const mode = getSalePaymentMode(r);
    let block = map.get(name);
    if (!block) {
      block = {
        name,
        ordersPunched: 0,
        ordersSuccess: 0,
        ordersCancelled: 0,
        ordersDiscounted: 0,
        ordersModified: 0,
        ordersReprinted: 0,
        payments: emptyPaymentMap(),
        subTotal: 0,
      };
      map.set(name, block);
    }

    block.ordersPunched += 1;
    if (isSaleCancelled(r)) {
      block.ordersCancelled += 1;
      continue;
    }
    block.ordersSuccess += 1;
    block.subTotal += amt;
    if (saleOrderDiscountAmount(r) > 0) block.ordersDiscounted += 1;
    if (hasTruthyFlag(r, "modified", "Modified", "isModified")) block.ordersModified += 1;
    if (hasTruthyFlag(r, "reprinted", "Reprinted", "isReprint", "wasReprinted")) block.ordersReprinted += 1;
    block.payments[paymentBucket(mode)] += amt;
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function SalesEmployeeReportPage() {
  const today = getTodayDateInputValue();
  const yesterday = addCalendarDaysISO(today, -1);

  const [preset, setPreset] = useState<"custom" | "today" | "yesterday">("today");
  const [draftFrom, setDraftFrom] = useState(today);
  const [draftTo, setDraftTo] = useState(today);

  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string }>({
    start: today,
    end: today,
  });

  const [rangeError, setRangeError] = useState<string | null>(null);

  useEffect(() => {
    setRangeError(null);
  }, [draftFrom, draftTo]);

  const listQuery = useList<SaleRecord>({
    resource: "sales",
    pagination: { mode: "off" },
    errorNotification: false,
    queryOptions: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  });

  const totalPublished = listQuery.result?.total;
  const dataCount = listQuery.result?.data?.length ?? 0;
  const truncated =
    (typeof totalPublished === "number" &&
      Number.isFinite(totalPublished) &&
      totalPublished > dataCount) ||
    dataCount >= SALES_LIST_CAP;

  const salesInRange = useMemo(() => {
    const data = listQuery.result?.data ?? [];
    const r = appliedRange;
    return data.filter((sale) => {
      const dk = getSaleRecordLocalDateKey(sale);
      return dk !== "" && dk >= r.start && dk <= r.end;
    });
  }, [listQuery.result?.data, appliedRange]);

  const billerBlocks = useMemo(() => aggregateByBiller(salesInRange), [salesInRange]);
  const grandTotal = useMemo(
    () => billerBlocks.reduce((s, b) => s + b.subTotal, 0),
    [billerBlocks],
  );

  const titleSuffix = formatReportTitleRange(appliedRange.start, appliedRange.end);

  const fromInputBounds = useMemo(() => {
    if (!isYyyyMmDd(draftTo)) return {};
    const t = draftTo.trim();
    return { min: addCalendarDaysISO(t, -MAX_GAP_DAYS), max: t };
  }, [draftTo]);

  const toInputBounds = useMemo(() => {
    if (!isYyyyMmDd(draftFrom)) return {};
    const f = draftFrom.trim();
    return { min: f, max: addCalendarDaysISO(f, MAX_GAP_DAYS) };
  }, [draftFrom]);

  const handleDraftFromChange = (next: string) => {
    setPreset("custom");
    setDraftFrom(next);
    if (!isYyyyMmDd(next)) return;
    setDraftTo((prev) => {
      if (!isYyyyMmDd(prev)) return prev;
      const maxTo = addCalendarDaysISO(next, MAX_GAP_DAYS);
      if (prev > maxTo) return maxTo;
      if (prev < next) return next;
      return prev;
    });
  };

  const handleDraftToChange = (next: string) => {
    setPreset("custom");
    setDraftTo(next);
    if (!isYyyyMmDd(next)) return;
    setDraftFrom((prev) => {
      if (!isYyyyMmDd(prev)) return prev;
      const minFrom = addCalendarDaysISO(next, -MAX_GAP_DAYS);
      if (prev < minFrom) return minFrom;
      if (prev > next) return next;
      return prev;
    });
  };

  const normalizedDraft = normalizedDateRange(draftFrom, draftTo);

  const applyRange = (start: string, end: string) => {
    setAppliedRange(start <= end ? { start, end } : { start: end, end: start });
    setDraftFrom(start <= end ? start : end);
    setDraftTo(start <= end ? end : start);
  };

  const handleApply = () => {
    setRangeError(null);
    const r = normalizedDraft;
    if (!r || !isYyyyMmDd(r.start) || !isYyyyMmDd(r.end)) {
      setRangeError("Pick valid From and To dates.");
      return;
    }
    const n = inclusiveCalendarDayCount(r.start, r.end);
    if (!Number.isFinite(n) || n <= 0) {
      setRangeError("Those dates aren’t valid.");
      return;
    }
    if (n > MAX_RANGE_DAYS) {
      setRangeError(`Pick at most ${MAX_RANGE_DAYS} days inclusive.`);
      return;
    }
    applyRange(r.start, r.end);
  };

  const handlePresetToday = () => {
    setPreset("today");
    setRangeError(null);
    applyRange(today, today);
  };

  const handlePresetYesterday = () => {
    setPreset("yesterday");
    setRangeError(null);
    applyRange(yesterday, yesterday);
  };

  const applyDisabled =
    !normalizedDraft ||
    !isYyyyMmDd(normalizedDraft.start) ||
    !isYyyyMmDd(normalizedDraft.end) ||
    (normalizedDraft.start === appliedRange.start && normalizedDraft.end === appliedRange.end);

  const rowSpan = PAYMENT_ROWS.length;

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Button
            component={Link}
            to="/sales"
            size="small"
            startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 14 }} />}
            sx={{ mb: -0.25 }}
          >
            Sales
          </Button>
          <Typography variant="h5" component="h1">
            Employee Report - {titleSuffix}
          </Typography>
        </Stack>
      </Stack>

      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
        <ToggleButtonGroup
          value={preset}
          exclusive
          size="small"
          onChange={(_, v) => {
            if (!v) return;
            if (v === "today") handlePresetToday();
            if (v === "yesterday") handlePresetYesterday();
            if (v === "custom") setPreset("custom");
          }}
        >
          <ToggleButton value="today">Today</ToggleButton>
          <ToggleButton value="yesterday">Yesterday</ToggleButton>
          <ToggleButton value="custom">Custom range</ToggleButton>
        </ToggleButtonGroup>

        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
          <TextField
            label="From"
            type="date"
            size="small"
            value={draftFrom}
            disabled={preset !== "custom"}
            onChange={(e) => handleDraftFromChange(e.target.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: fromInputBounds,
            }}
            sx={{ width: { xs: "100%", sm: 160 } }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
            to
          </Typography>
          <TextField
            label="To"
            type="date"
            size="small"
            value={draftTo}
            disabled={preset !== "custom"}
            onChange={(e) => handleDraftToChange(e.target.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: toInputBounds,
            }}
            sx={{ width: { xs: "100%", sm: 160 } }}
          />
          <Button variant="contained" size="medium" onClick={handleApply} disabled={preset !== "custom" || applyDisabled}>
            Apply
          </Button>
        </Stack>
      </Stack>

      {rangeError ? (
        <Typography variant="body2" color="error" role="alert">
          {rangeError}
        </Typography>
      ) : null}

      {preset === "custom" ? (
        <Typography variant="caption" color="text.secondary">
          Custom range: at most {MAX_RANGE_DAYS} days. Choose dates and Apply.
        </Typography>
      ) : null}

      {truncated ? (
        <Alert severity="warning">
          Only the latest {dataCount.toLocaleString()}
          {typeof totalPublished === "number" && totalPublished > dataCount
            ? ` of ${totalPublished.toLocaleString()}`
            : ""}{" "}
          sales are loaded — this report may be incomplete for older dates.
        </Alert>
      ) : null}

      <Typography
        variant="subtitle2"
        sx={{
          py: 1,
          px: 2,
          bgcolor: "#c8e6c9",
          borderRadius: 1,
          fontWeight: 700,
          letterSpacing: 0.02,
        }}
      >
        Biller Report
      </Typography>

      {listQuery.query.isPending ? (
        <Typography color="text.secondary">Loading sales…</Typography>
      ) : listQuery.query.isError ? (
        <Typography color="error">Could not load sales. Try again later.</Typography>
      ) : billerBlocks.length === 0 ? (
        <Alert severity="info">No sales found for this date selection.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: 900 }}>
          <Table size="small" sx={{ "& .MuiTableCell-root": { borderColor: "divider", py: 1 } }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell sx={{ fontWeight: 700, width: "36%" }}>Billing User</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Payment Type</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Total (₹)
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {billerBlocks.map((biller) =>
                PAYMENT_ROWS.map((row, idx) => (
                  <TableRow key={`${biller.name}-${row.id}`}>
                    {idx === 0 ? (
                      <TableCell rowSpan={rowSpan} valign="top" sx={{ bgcolor: "#fafafa", borderRight: 1, borderColor: "divider" }}>
                        <Typography fontWeight={700} gutterBottom>
                          {biller.name}
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 1.25, bgcolor: "#fff", fontSize: "0.8125rem" }}>
                          <Typography variant="body2">
                            Orders Punched: <strong>{biller.ordersPunched}</strong>
                          </Typography>
                          <Typography variant="body2">
                            Orders Success: <strong>{biller.ordersSuccess}</strong>
                          </Typography>
                          <Typography variant="body2">
                            Orders Cancelled: <strong>{biller.ordersCancelled}</strong>
                          </Typography>
                          <Typography variant="body2">
                            Orders Discounted: <strong>{biller.ordersDiscounted}</strong>
                          </Typography>
                          <Typography variant="body2">
                            Orders Modified: <strong>{biller.ordersModified}</strong>
                          </Typography>
                          <Typography variant="body2">
                            Orders Reprinted: <strong>{biller.ordersReprinted}</strong>
                          </Typography>
                        </Paper>
                      </TableCell>
                    ) : null}
                    <TableCell>{row.label}</TableCell>
                    <TableCell align="right">
                      {biller.payments[row.id].toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                )),
              )}
              <TableRow sx={{ fontWeight: 700, bgcolor: "grey.100" }}>
                <TableCell colSpan={2}>Sub Total</TableCell>
                <TableCell align="right">
                  {grandTotal.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
