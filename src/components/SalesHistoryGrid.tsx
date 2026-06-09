import {
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
} from "@mui/x-data-grid";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import PrintIcon from "@mui/icons-material/Print";
import SyncIcon from "@mui/icons-material/Sync";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import { useQueryClient } from "@tanstack/react-query";
import { keys, useNotification } from "@refinedev/core";
import { buildSaleUpdatePayload, patchSale } from "../api/saleUpdate";
import { useOutlet } from "../context/outlet-context";
import type { SalesGridRow } from "../types/sale";
import {
  formatRupeeInr,
  formatSaleGridDiscountCell,
  getSaleDiscountAmountRupees,
  isSalePaymentDue,
} from "../types/sale";
import { formatPaymentDisplayLabel } from "../types/payment";
import { printThermalInvoice } from "../utils/thermalInvoice";
import type { InvoiceData } from "../types/thermalInvoice";
import { EditSaleDialog } from "./EditSaleDialog";
import { getSessionCashierName } from "../providers/authProvider";

/** Epoch ms for sorting — prefers ISO from API, else parses formatted `createdAt`. */
function saleRowSortTimestampMs(row: SalesGridRow): number {
  if (row.createdAtIso) {
    const t = Date.parse(row.createdAtIso);
    if (!Number.isNaN(t)) return t;
  }
  const t = Date.parse(row.createdAt);
  return Number.isNaN(t) ? 0 : t;
}

/** Digits only; for 10+ digits use last 10 so +91 / leading 0 variants match. */
function normalizePhoneGroupKey(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

/** Group Outstanding dues: same normalized phone ⇒ one customer; no phone ⇒ name (best effort); neither ⇒ per-row. */
function outstandingDueGroupKey(row: SalesGridRow): string {
  const phoneKey = normalizePhoneGroupKey((row.customer?.phone ?? "").trim());
  if (phoneKey.length > 0) return `p:${phoneKey}`;
  const name = (row.customer?.name ?? "").trim().toLowerCase();
  if (name.length > 0) return `n:${name}`;
  return `\0uniq:${row.id}`;
}

function escapeCsvField(s: string): string {
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadSalesCsv(rows: SalesGridRow[]) {
  const headers = [
    "salesId",
    "Products",
    "Items Count",
    "Discount",
    "Amount",
    "CreatedAt",
  ];
  const body = rows
    .map((r) =>
      [
        escapeCsvField(r.salesId),
        escapeCsvField(r.products),
        String(r.itemsCount),
        String(getSaleDiscountAmountRupees(r.discount)),
        String(r.amount),
        escapeCsvField(r.createdAt),
      ].join(","),
    )
    .join("\n");
  const blob = new Blob([`${headers.join(",")}\n${body}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sales-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDateFromCreatedAt(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function gridRowInvoiceDate(row: SalesGridRow): string {
  if (row.createdAtIso) {
    const d = new Date(row.createdAtIso);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return `${dd}-${mm}-${d.getFullYear()}`;
    }
  }
  return formatDateFromCreatedAt(row.createdAt);
}

function gridRowBillTime(row: SalesGridRow): string | undefined {
  if (!row.createdAtIso) return undefined;
  const d = new Date(row.createdAtIso);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function saleRowToInvoiceData(row: SalesGridRow): InvoiceData {
  return {
    invoiceNo: row.salesId,
    date: gridRowInvoiceDate(row),
    customerName: row.customer?.name,
    customerPhone: row.customer?.phone,
    customerAddress: row.customer?.address,
    items:
      row.rawItems.length > 0
        ? row.rawItems
        : [{ name: row.products, unitPrice: row.amount, quantity: 1, lineTotal: row.amount }],
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.amount,
    paymentMode: row.paymentMode,
    payments: row.payments,
    orderType: "Pick Up",
    billTime: gridRowBillTime(row),
    cashierName: getSessionCashierName(),
  };
}

function RowActions({
  row,
  onEdit,
  onRetrySync,
}: {
  row: SalesGridRow;
  onEdit: (row: SalesGridRow) => void;
  onRetrySync?: (localId: string) => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const handlePrint = () => {
    setAnchor(null);
    void printThermalInvoice(saleRowToInvoiceData(row)).catch(console.error);
  };

  const isPending = row.pendingSync || row.syncFailed;

  return (
    <>
      <IconButton
        size="small"
        aria-label="Row actions"
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {!isPending && (
          <MenuItem
            onClick={() => {
              setAnchor(null);
              onEdit(row);
            }}
          >
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={handlePrint}>
          <ListItemIcon><PrintIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Print Invoice</ListItemText>
        </MenuItem>
        {row.syncFailed && row.localId && (
          <MenuItem
            onClick={() => {
              setAnchor(null);
              onRetrySync?.(row.localId!);
            }}
          >
            <ListItemIcon><SyncIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Retry Sync</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

type CollectPaymentMode = "Cash" | "Card" | "UPI";

/** Due list only: dropdown chooses how payment was collected; triggers PATCH immediately. */
function CollectDuePaymentSelect({
  row,
  loading,
  onSelect,
}: {
  row: SalesGridRow;
  loading: boolean;
  onSelect: (row: SalesGridRow, mode: CollectPaymentMode) => Promise<void>;
}) {
  return (
    <TextField
      select
      size="small"
      value=""
      disabled={loading}
      fullWidth
      sx={{ maxWidth: 138, "& .MuiSelect-select": { py: 0.65 } }}
      slotProps={{
        htmlInput: { "aria-label": "Collected payment mode" },
        select: {
          displayEmpty: true,
          renderValue: () =>
            loading ? (
              <CircularProgress size={18} />
            ) : (
              <Typography
                variant="body2"
                color="text.secondary"
                component="span"
                sx={{ fontSize: "0.8rem" }}
              >
                Collect as…
              </Typography>
            ),
        },
      }}
      onChange={(e) => {
        const mode = e.target.value as CollectPaymentMode;
        if (!mode || loading) return;
        void onSelect(row, mode);
      }}
    >
      <MenuItem value="Cash">Cash</MenuItem>
      <MenuItem value="Card">Card</MenuItem>
      <MenuItem value="UPI">UPI</MenuItem>
    </TextField>
  );
}

type SalesHistoryGridProps = {
  rows: SalesGridRow[];
  loading: boolean;
  error: boolean;
  onRetrySync?: (localId: string) => void;
  /** Show Collected control (PATCH sale payment to Cash / Card / UPI). */
  dueCollectionMode?: boolean;
  /** Title shown above the grid */
  listTitle?: string;
  /** Server-driven paging (omit for a simple unpaginated table, e.g. offline queue only). */
  serverPagination?: {
    rowCount: number;
    paginationModel: GridPaginationModel;
    onPaginationModelChange: (model: GridPaginationModel) => void;
  };
  /** Compact table — no paging footer / export (offline queue slice). */
  compactTable?: boolean;
  /** Omit Export CSV (queue block). */
  hideExport?: boolean;
  /** Extra controls shown before Export (e.g. Item summary link). */
  toolbarExtra?: ReactNode;
};

export function SalesHistoryGrid({
  rows,
  loading,
  error,
  onRetrySync,
  dueCollectionMode = false,
  listTitle = "Sales",
  serverPagination,
  compactTable = false,
  hideExport = false,
  toolbarExtra,
}: SalesHistoryGridProps) {
  const queryClient = useQueryClient();
  const notification = useNotification();
  const { outletId: sessionOutletId } = useOutlet();
  const [editRow, setEditRow] = useState<SalesGridRow | null>(null);
  const [collectingId, setCollectingId] = useState<string | null>(null);

  const collectDuePayment = useCallback(
    async (row: SalesGridRow, mode: CollectPaymentMode) => {
      if (!row.documentId) {
        notification.open?.({
          type: "error",
          message: "Cannot collect",
          description: "Missing sale document id from server.",
        });
        return;
      }
      const oid = (row.outletId ?? sessionOutletId ?? "").trim();
      if (!oid) {
        notification.open?.({
          type: "error",
          message: "No outlet",
          description: "Sign in again.",
        });
        return;
      }
      setCollectingId(row.id);
      try {
        const payload = buildSaleUpdatePayload(
          oid,
          row.customer,
          row.rawItems,
          row.discount,
          mode,
          row.plainSaleId,
        );
        const res = await patchSale(row.documentId, payload);
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          const msg =
            (body && typeof body === "object" && "message" in body
              ? String((body as { message: unknown }).message)
              : null) || `HTTP ${res.status}`;
          notification.open?.({
            type: "error",
            message: "Could not mark collected",
            description: msg,
          });
          return;
        }
        notification.open?.({
          type: "success",
          message: "Marked as collected",
          description: `Payment recorded as ${mode}.`,
        });
        await queryClient.invalidateQueries({
          queryKey: keys().data().resource("sales").action("list").get(),
        });
      } catch {
        notification.open?.({
          type: "error",
          message: "Network error",
          description: "Could not reach the server.",
        });
      } finally {
        setCollectingId(null);
      }
    },
    [notification, queryClient, sessionOutletId],
  );

  const rowsSortedNewestFirst = useMemo(
    () => [...rows].sort((a, b) => saleRowSortTimestampMs(b) - saleRowSortTimestampMs(a)),
    [rows],
  );

  const { gridRows, dueRowGrouping } = useMemo(() => {
    if (!dueCollectionMode) {
      return {
        gridRows: rowsSortedNewestFirst,
        dueRowGrouping: null as Map<string, { index: number; total: number }> | null,
      };
    }
    const counts = new Map<string, number>();
    for (const r of rowsSortedNewestFirst) {
      const k = outstandingDueGroupKey(r);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const sorted = [...rowsSortedNewestFirst].sort((a, b) => {
      const cmp = outstandingDueGroupKey(a).localeCompare(outstandingDueGroupKey(b));
      if (cmp !== 0) return cmp;
      return saleRowSortTimestampMs(b) - saleRowSortTimestampMs(a);
    });
    const grouping = new Map<string, { index: number; total: number }>();
    const nextIndexByKey = new Map<string, number>();
    for (const r of sorted) {
      const k = outstandingDueGroupKey(r);
      const total = counts.get(k) ?? 1;
      const idx = (nextIndexByKey.get(k) ?? 0) + 1;
      nextIndexByKey.set(k, idx);
      grouping.set(r.id, { index: idx, total });
    }
    return { gridRows: sorted, dueRowGrouping: grouping };
  }, [dueCollectionMode, rowsSortedNewestFirst]);

  const columns: GridColDef<SalesGridRow>[] = useMemo(() => {
    const base: GridColDef<SalesGridRow>[] = [
      {
        field: "salesId",
        headerName: "salesId",
        flex: 0.5,
        minWidth: 80,
        renderCell: (params) => {
          const row = params.row;
          if (row.syncFailed) {
            return (
              <Chip
                icon={<WifiOffIcon />}
                label="Sync failed"
                color="error"
                size="small"
                variant="outlined"
              />
            );
          }
          if (row.pendingSync) {
            return (
              <Chip
                icon={<WifiOffIcon />}
                label="Pending sync"
                color="warning"
                size="small"
                variant="outlined"
              />
            );
          }
          return <Typography variant="body2">{params.value as string}</Typography>;
        },
      },
      {
        field: "products",
        headerName: "Products",
        flex: 0.6,
        minWidth: 40,
      },
      {
        field: "itemsCount",
        headerName: "Items",
        flex: 0.3,
        minWidth: 80,
        type: "number",
        align: "center",
        headerAlign: "center",
      },
      ...(dueCollectionMode
        ? ([
            {
              field: "customerName",
              headerName: "Name",
              flex: 1,
              minWidth: 120,
              sortable: false,
              renderCell: (params: { row: SalesGridRow }) => {
                const name = (params.row.customer?.name ?? "").trim();
                const grp = dueRowGrouping?.get(params.row.id);
                const subtitle =
                  grp && grp.total > 1 ? `Due ${grp.index} / ${grp.total}` : "";
                const title = [name || "—", subtitle].filter(Boolean).join(" — ");
                return (
                  <Stack spacing={0} sx={{ minWidth: 0, py: 0.25 }}>
                    <Typography variant="body2" noWrap title={title}>
                      {name || "—"}
                    </Typography>
                    {subtitle ? (
                      <Typography variant="caption" color="text.secondary" noWrap title={subtitle}>
                        {subtitle}
                      </Typography>
                    ) : null}
                  </Stack>
                );
              },
            },
            {
              field: "collectDue",
              headerName: "Payment",
              minWidth: 148,
              flex: 0.75,
              sortable: false,
              filterable: false,
              disableColumnMenu: true,
              align: "center",
              headerAlign: "center",
              renderCell: (params: { row: SalesGridRow }) => {
                const row = params.row;
                if (row.pendingSync || row.syncFailed || !row.documentId) {
                  return (
                    <Typography variant="caption" color="text.disabled">
                      —
                    </Typography>
                  );
                }
                const load = collectingId === row.id;
                return (
                  <CollectDuePaymentSelect
                    row={row}
                    loading={load}
                    onSelect={(r, mode) => collectDuePayment(r, mode)}
                  />
                );
              },
            },
          ] as GridColDef<SalesGridRow>[])
        : ([
            {
              field: "paymentMode",
              headerName: "Payment",
              flex: 0.5,
              minWidth: 96,
              sortable: false,
              renderCell: (params: { row: SalesGridRow }) => {
                const row = params.row;
                if (row.pendingSync || row.syncFailed) {
                  return (
                    <Typography variant="caption" color="text.secondary">
                      —
                    </Typography>
                  );
                }
                if (isSalePaymentDue(row.paymentMode)) {
                  return (
                    <Chip
                      label="Due"
                      color="warning"
                      size="small"
                      variant="outlined"
                      sx={{ height: 22, fontSize: "0.7rem" }}
                    />
                  );
                }
                const label = formatPaymentDisplayLabel(row.paymentMode, row.payments);
                return (
                  <Typography
                    variant="body2"
                    sx={{ fontSize: "0.72rem", lineHeight: 1.3, whiteSpace: "normal" }}
                    title={label}
                  >
                    {label}
                  </Typography>
                );
              },
            },
          ] as GridColDef<SalesGridRow>[])),
      {
        field: "discount",
        headerName: "Discount",
        flex: 0.5,
        minWidth: 104,
        align: "center",
        headerAlign: "center",
        type: "number",
        valueGetter: (_, row) => getSaleDiscountAmountRupees(row.discount),
        renderCell: (params) => (
          <Typography variant="body2" sx={{ width: "100%", textAlign: "center" }}>
            {formatSaleGridDiscountCell(params.row.discount)}
          </Typography>
        ),
      },
      {
        field: "amount",
        headerName: "Amount",
        flex: 0.8,
        minWidth: 90,
        align: "center",
        headerAlign: "center",
        type: "number",
        valueGetter: (_, row) => row.amount,
        renderCell: (params) => (
          <Typography variant="body2" sx={{ width: "100%", textAlign: "center" }}>
            {formatRupeeInr(params.row.amount)}
          </Typography>
        ),
      },
      {
        field: "createdAt",
        headerName: "CreatedAt",
        flex: 1.2,
        minWidth: 100,
        align: "center",
        headerAlign: "center",
        type: "number",
        valueGetter: (_, row) => saleRowSortTimestampMs(row),
        renderCell: (params) => (
          <Typography variant="body2">{params.row.createdAt}</Typography>
        ),
      },
    ];

    base.push({
      field: "actions",
      headerName: "Actions",
      width: 70,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <RowActions
          row={params.row}
          onEdit={(r) => setEditRow(r)}
          onRetrySync={onRetrySync}
        />
      ),
    });

    return base;
  }, [dueCollectionMode, collectingId, collectDuePayment, onRetrySync, dueRowGrouping]);

  const header = (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      flexWrap="wrap"
      gap={2}
      sx={{ mb: compactTable ? 1 : 2 }}
    >
      <Typography variant={compactTable ? "subtitle1" : "h5"} component="h1">
        {listTitle}
      </Typography>
      {!hideExport || toolbarExtra != null ? (
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
          {toolbarExtra}
          {!hideExport && (
            <Button
              variant="outlined"
              size="medium"
              startIcon={<FileDownloadOutlinedIcon />}
              disabled={gridRows.length === 0 || loading}
              onClick={() => downloadSalesCsv(gridRows)}
            >
              Export
            </Button>
          )}
        </Stack>
      ) : null}
    </Stack>
  );

  if (loading) {
    return (
      <>
        {header}
        <Box display="flex" justifyContent="center" py={5}>
          <CircularProgress size={36} />
        </Box>
      </>
    );
  }

  if (error) {
    return (
      <>
        {header}
        <Typography color="error" sx={{ py: 2 }}>
          Could not load sales. Try again later.
        </Typography>
      </>
    );
  }

  return (
    <>
      <EditSaleDialog
        open={editRow != null}
        row={editRow}
        onClose={() => setEditRow(null)}
      />

      {header}

      {gridRows.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 3 }}>
          {dueCollectionMode ? "No outstanding due sales." : "No recorded sales yet."}
        </Typography>
      ) : (
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <DataGrid
            rows={gridRows}
            columns={columns}
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50, 100]}
            {...(compactTable
              ? {
                  hideFooter: true as const,
                  paginationMode: "client" as const,
                  paginationModel: {
                    page: 0,
                    pageSize: Math.max(gridRows.length, 1),
                  },
                  onPaginationModelChange: (
                    _: GridPaginationModel,
                  ): void => {
                    /** Single-page block; paging UI hidden via hideFooter. */
                  },
                }
              : serverPagination
                ? {
                    paginationMode: "server" as const,
                    rowCount: Math.max(serverPagination.rowCount, 0),
                    paginationModel: serverPagination.paginationModel,
                    onPaginationModelChange: serverPagination.onPaginationModelChange,
                  }
                : {
                    paginationMode: "client" as const,
                  })}
            initialState={{
              ...(!compactTable && !serverPagination
                ? { pagination: { paginationModel: { pageSize: 10 } } }
                : {}),
              sorting: {
                sortModel: [{ field: "createdAt", sort: "desc" }],
              },
            }}
            sx={{
              minWidth: 600,
              width: "100%",
              ...(!compactTable ? { height: 560 } : {}),
              "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 600 },
              "& .MuiDataGrid-cell": { alignItems: "center", display: "flex" },
            }}
            autoHeight={compactTable}
            disableColumnResize={false}
          />
        </Box>
      )}
    </>
  );
}
