import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
import PrintIcon from "@mui/icons-material/Print";
import type { SalesGridRow } from "../types/sale";
import { formatRupeeInr } from "../types/sale";
import { printThermalInvoice } from "../utils/thermalInvoice";

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

function RowActions({ row }: { row: SalesGridRow }) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const handlePrint = () => {
    setAnchor(null);
    printThermalInvoice({
      invoiceNo: row.salesId,
      date: formatDateFromCreatedAt(row.createdAt),
      customerName: row.customer?.name,
      customerPhone: row.customer?.phone,
      customerAddress: row.customer?.address,
      items: row.rawItems.length > 0
        ? row.rawItems
        : [{ name: row.products, unitPrice: row.amount, quantity: 1, lineTotal: row.amount }],
      total: row.amount,
    });
  };

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
        <MenuItem onClick={handlePrint}>
          <ListItemIcon><PrintIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Print Invoice</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            void navigator.clipboard.writeText(row.salesId);
            setAnchor(null);
          }}
        >
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Copy salesId</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

type SalesHistoryGridProps = {
  rows: SalesGridRow[];
  loading: boolean;
  error: boolean;
};

export function SalesHistoryGrid({ rows, loading, error }: SalesHistoryGridProps) {
  const columns: GridColDef<SalesGridRow>[] = useMemo(
    () => [
      {
        field: "salesId",
        headerName: "salesId",
        flex: 1,
        minWidth: 100,
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
        renderCell: (params) => <RowActions row={params.row} />,
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
