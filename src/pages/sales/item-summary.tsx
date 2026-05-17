import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { Link } from "react-router";
import { useList } from "@refinedev/core";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import type { ItemSummaryRow, SaleRecord } from "../../types/sale";
import {
  getSaleRecordLocalDateKey,
  itemSummaryRowsFromSaleRecords,
} from "../../types/sale";

const SALES_LIST_CAP = 2000;

/** Max inclusive calendar days From→To */
const MAX_RANGE_DAYS = 7;
const MAX_GAP_DAYS = MAX_RANGE_DAYS - 1;

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

/** Inclusive day count between two dates (must be canonical start ≤ end). */
function inclusiveCalendarDayCount(start: string, end: string): number {
  const a = parseLocalDateAtNoon(start);
  const b = parseLocalDateAtNoon(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return NaN;
  const diff = Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
  return diff + 1;
}

export function SalesItemSummaryPage() {
  const [draftFrom, setDraftFrom] = useState(() => getTodayDateInputValue());
  const [draftTo, setDraftTo] = useState(() => getTodayDateInputValue());

  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string }>(() => {
    const t = getTodayDateInputValue();
    return { start: t, end: t };
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

  const rows = useMemo(() => itemSummaryRowsFromSaleRecords(salesInRange), [salesInRange]);

  const columns = useMemo<GridColDef<ItemSummaryRow>[]>(
    () => [
      {
        field: "dateLabel",
        headerName: "Date",
        flex: 1,
        minWidth: 160,
        sortable: false,
      },
      {
        field: "productName",
        headerName: "Product",
        flex: 1.4,
        minWidth: 200,
        sortable: false,
      },
      {
        field: "quantity",
        headerName: "Qty",
        width: 100,
        type: "number",
        align: "right",
        headerAlign: "right",
        sortable: false,
      },
    ],
    [],
  );

  const totalDisplay =
    typeof totalPublished === "number" &&
    Number.isFinite(totalPublished) &&
    totalPublished > 0
      ? Math.max(totalPublished, dataCount)
      : null;

  /** Calendar picker: enforce at most 7 days between From and To. */
  const fromInputBounds = useMemo(() => {
    if (!isYyyyMmDd(draftTo)) return {};
    const t = draftTo.trim();
    return {
      min: addCalendarDaysISO(t, -MAX_GAP_DAYS),
      max: t,
    };
  }, [draftTo]);

  const toInputBounds = useMemo(() => {
    if (!isYyyyMmDd(draftFrom)) return {};
    const f = draftFrom.trim();
    return {
      min: f,
      max: addCalendarDaysISO(f, MAX_GAP_DAYS),
    };
  }, [draftFrom]);

  const handleDraftFromChange = (next: string) => {
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

    setAppliedRange(r);
    setDraftFrom(r.start);
    setDraftTo(r.end);
  };

  const applyDisabled =
    !normalizedDraft ||
    !isYyyyMmDd(normalizedDraft.start) ||
    !isYyyyMmDd(normalizedDraft.end) ||
    (normalizedDraft.start === appliedRange.start && normalizedDraft.end === appliedRange.end);

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
            Item summary
          </Typography>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary">
        How much you sold each day, item by item.
      </Typography>

      <Stack spacing={1}>
        <Stack direction="row" alignItems="flex-start" flexWrap="wrap" gap={2}>
          <Typography variant="subtitle2" component="span" sx={{ fontWeight: 600, alignSelf: "center" }}>
            Date range
          </Typography>
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
            <TextField
              id="item-summary-from"
              label="From"
              type="date"
              size="small"
              value={draftFrom}
              onChange={(e) => handleDraftFromChange(e.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: fromInputBounds,
              }}
              sx={{ width: { xs: "100%", sm: 160 } }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ px: 0.5, alignSelf: "center" }}>
              to
            </Typography>
            <TextField
              id="item-summary-to"
              label="To"
              type="date"
              size="small"
              value={draftTo}
              onChange={(e) => handleDraftToChange(e.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: toInputBounds,
              }}
              sx={{ width: { xs: "100%", sm: 160 } }}
            />
          </Stack>
          <Button
            variant="contained"
            size="medium"
            sx={{ alignSelf: "center" }}
            onClick={handleApply}
            disabled={applyDisabled}
          >
            Apply
          </Button>
        </Stack>

        {rangeError ? (
          <Typography variant="body2" color="error" role="alert">
            {rangeError}
          </Typography>
        ) : null}
      </Stack>

      {truncated ? (
        <Alert severity="warning">
          Only the latest batch of invoices is loaded here ({dataCount.toLocaleString()}
          {totalDisplay != null ? ` of ${totalDisplay.toLocaleString()}` : ""}), so totals may miss older
          days.
        </Alert>
      ) : null}

      {!listQuery.query.isPending &&
      !listQuery.query.isError &&
      dataCount > 0 &&
      salesInRange.length === 0 ? (
        <Alert severity="info">No sales for the applied date range.</Alert>
      ) : null}

      {listQuery.query.isPending ? (
        <Typography color="text.secondary">Loading sales…</Typography>
      ) : listQuery.query.isError ? (
        <Typography color="error">Could not load sales. Try again later.</Typography>
      ) : (
        <DataGrid
          rows={rows}
          columns={columns}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          density="compact"
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
          }}
          sx={{
            "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 600 },
            "& .MuiDataGrid-cell": { alignItems: "center", display: "flex" },
          }}
          autoHeight
        />
      )}
    </Stack>
  );
}
