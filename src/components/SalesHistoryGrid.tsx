import { useMemo, useState } from "react";
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
import Typography from "@mui/material/Typography";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import PrintIcon from "@mui/icons-material/Print";
import SyncIcon from "@mui/icons-material/Sync";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import type { SalesGridRow } from "../types/sale";
import { formatRupeeInr } from "../types/sale";
import { printThermalInvoice } from "../utils/thermalInvoice";
import type { InvoiceData } from "../types/thermalInvoice";
import { EditSaleDialog } from "./EditSaleDialog";
import { getSessionCashierName } from "../providers/authProvider";

function escapeCsvField(s: string): string {
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadSalesCsv(rows: SalesGridRow[]) {
  const headers = ["salesId", "Products", "Items Count", "Amount", "CreatedAt"];
  const body = rows
    .map((r) =>
      [
        escapeCsvField(r.salesId),
        escapeCsvField(r.products),
        String(r.itemsCount),
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
        {!isPending && (
          <MenuItem
            onClick={() => {
              void navigator.clipboard.writeText(row.salesId);
              setAnchor(null);
            }}
          >
            <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Copy salesId</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

type SalesHistoryGridProps = {
  rows: SalesGridRow[];
  loading: boolean;
  error: boolean;
  onRetrySync?: (localId: string) => void;
};

export function SalesHistoryGrid({ rows, loading, error, onRetrySync }: SalesHistoryGridProps) {
  const [editRow, setEditRow] = useState<SalesGridRow | null>(null);

  const columns: GridColDef<SalesGridRow>[] = useMemo(
    () => [
      {
        field: "salesId",
        headerName: "salesId",
        flex: 1,
        minWidth: 120,
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
        flex: 2,
        minWidth: 140,
      },
      {
        field: "itemsCount",
        headerName: "Items Count",
        flex: 0.6,
        minWidth: 80,
        type: "number",
        align: "right",
        headerAlign: "right",
      },
      {
        field: "amount",
        headerName: "Amount",
        flex: 0.8,
        minWidth: 90,
        align: "right",
        headerAlign: "right",
        type: "number",
        valueGetter: (_, row) => row.amount,
        renderCell: (params) => (
          <Typography variant="body2" sx={{ width: "100%", textAlign: "right" }}>
            {formatRupeeInr(params.row.amount)}
          </Typography>
        ),
      },
      {
        field: "createdAt",
        headerName: "CreatedAt",
        flex: 1.2,
        minWidth: 130,
      },
      {
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
      },
    ],
    [],
  );

  const header = (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      flexWrap="wrap"
      gap={2}
      sx={{ mb: 2 }}
    >
      <Typography variant="h5" component="h1">
        Sales
      </Typography>
      <Button
        variant="outlined"
        size="medium"
        startIcon={<FileDownloadOutlinedIcon />}
        disabled={rows.length === 0 || loading}
        onClick={() => downloadSalesCsv(rows)}
      >
        Export
      </Button>
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

      {rows.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 3 }}>
          No recorded sales yet.
        </Typography>
      ) : (
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <DataGrid
            rows={rows}
            columns={columns}
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
              sorting: {
                sortModel: [{ field: "createdAt", sort: "desc" }],
              },
            }}
            sx={{
              minWidth: 600,
              "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 600 },
              "& .MuiDataGrid-cell": { alignItems: "center", display: "flex" },
            }}
            autoHeight
            disableColumnResize={false}
          />
        </Box>
      )}
    </>
  );
}
