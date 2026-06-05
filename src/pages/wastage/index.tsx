import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
} from "@mui/x-data-grid";
import { useList, useNotification } from "@refinedev/core";
import { useOutlet } from "../../context/outlet-context";
import { API_BASE_URL } from "../../config";
import { getApiHeaders } from "../../providers/authProvider";
import type { Product } from "../../types/product";
import type { WastageRecord } from "../../types/wastage";
import { WASTAGE_REASONS } from "../../types/wastage";

function getTodayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function recordDateKey(date: string | undefined): string {
  if (!date) return "";
  return date.slice(0, 10);
}

function formatDateLabel(dateKey: string): string {
  if (!dateKey) return "—";
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const MAX_DATE_RANGE_DAYS = 30;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function inclusiveDayCount(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00`).getTime();
  const e = new Date(`${end}T00:00:00`).getTime();
  return Math.floor((e - s) / (24 * 60 * 60 * 1000)) + 1;
}

function isDateRangeOverMaxDays(start: string, end: string): boolean {
  return inclusiveDayCount(start, end) > MAX_DATE_RANGE_DAYS;
}

function reasonToFormFields(reason: string): { reason: string; otherReason: string } {
  const preset = WASTAGE_REASONS.find((r) => r.value === reason);
  if (preset) return { reason: preset.value, otherReason: "" };
  return { reason: "other", otherReason: reason };
}

function parseWastageListEnvelope(json: unknown): {
  rows: Record<string, unknown>[];
  total: number;
} {
  if (Array.isArray(json)) {
    return { rows: json as Record<string, unknown>[], total: json.length };
  }
  if (!json || typeof json !== "object") {
    return { rows: [], total: 0 };
  }
  const o = json as Record<string, unknown>;
  const nested = o.data ?? o.items ?? o.results;
  const rows = Array.isArray(nested) ? (nested as Record<string, unknown>[]) : [];
  let total = rows.length;
  const p = o.pagination;
  if (p && typeof p === "object" && p !== null) {
    const t = Number((p as Record<string, unknown>).total);
    if (!Number.isNaN(t)) total = Math.trunc(Math.max(t, 0));
  }
  return { rows, total };
}

export const WastagePage = () => {
  const notification = useNotification();
  const { outletId } = useOutlet();

  const today = getTodayIso();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [appliedStart, setAppliedStart] = useState(today);
  const [appliedEnd, setAppliedEnd] = useState(today);

  const [rows, setRows] = useState<WastageRecord[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  const fetchWastage = useCallback(
    async (
      rangeStart: string,
      rangeEnd: string,
      page: number,
      pageSize: number,
    ) => {
      if (!outletId || !rangeStart || !rangeEnd) return;
      if (rangeStart > rangeEnd || isDateRangeOverMaxDays(rangeStart, rangeEnd)) {
        setRows([]);
        setRowCount(0);
        return;
      }
      const limit = Math.max(1, pageSize);
      const skip = Math.max(0, page) * limit;
      setListLoading(true);
      setListError(false);
      try {
        const qs = new URLSearchParams({
          outletId,
          startDate: rangeStart,
          endDate: rangeEnd,
          skip: String(skip),
          limit: String(limit),
        });
        const res = await fetch(`${API_BASE_URL}/wastage?${qs.toString()}`, {
          headers: getApiHeaders(),
        });
        if (!res.ok) throw new Error("non-ok");
        const json = await res.json();
        const { rows: raw, total } = parseWastageListEnvelope(json);
        const mapped = raw.map((r) => ({
          ...(r as WastageRecord),
          id: String(r._id ?? r.id ?? ""),
        }));
        setRows(mapped);
        setRowCount(total);
      } catch {
        setListError(true);
        setRows([]);
        setRowCount(0);
      } finally {
        setListLoading(false);
      }
    },
    [outletId],
  );

  useEffect(() => {
    if (!outletId) return;
    void fetchWastage(
      appliedStart,
      appliedEnd,
      paginationModel.page,
      paginationModel.pageSize,
    );
  }, [
    outletId,
    appliedStart,
    appliedEnd,
    paginationModel.page,
    paginationModel.pageSize,
    fetchWastage,
  ]);

  const handleApplyDateRange = () => {
    if (!startDate || !endDate) return;
    if (startDate > endDate) {
      notification.open?.({
        type: "error",
        message: "Invalid date range",
        description: "From date must be on or before To date.",
      });
      return;
    }
    if (isDateRangeOverMaxDays(startDate, endDate)) {
      notification.open?.({
        type: "error",
        message: "Date range too long",
        description: `Select at most ${MAX_DATE_RANGE_DAYS} days.`,
      });
      return;
    }
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  };

  const productsQuery = useList<Product>({
    resource: "products",
    pagination: { mode: "off" },
    errorNotification: false,
    queryOptions: { staleTime: 5 * 60 * 1000 },
  });
  const products = productsQuery.result?.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [quantityTouched, setQuantityTouched] = useState(false);
  const [unit, setUnit] = useState<string>("");
  const [price, setPrice] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [reason, setReason] = useState<string>("expired");
  const [otherReason, setOtherReason] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPhoneTouched, setCustomerPhoneTouched] = useState(false);
  const [customerAddress, setCustomerAddress] = useState("");
  const [wastageDate, setWastageDate] = useState(getTodayIso());
  const [submitting, setSubmitting] = useState(false);

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  type ConfirmAction = {
    type: "accept" | "reject" | "delete";
    record: WastageRecord;
  };
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const quantityError = useMemo(() => {
    const v = Number(quantity);
    if (!quantity.trim()) return "Quantity is required.";
    if (!Number.isFinite(v) || v <= 0) return "Enter a positive number.";
    return "";
  }, [quantity]);

  const priceError = useMemo(() => {
    const v = Number(price);
    if (!price.trim()) return "Price is required.";
    if (!Number.isFinite(v) || v < 0) return "Enter a valid price.";
    return "";
  }, [price]);

  const customerPhoneError = useMemo(() => {
    const digits = customerPhone.replace(/\D/g, "");
    if (!digits) return "Phone number is required.";
    if (digits.length !== 10) return "Enter a 10-digit phone number.";
    return "";
  }, [customerPhone]);

  const formValid = useMemo(() => {
    const otherReasonOk = reason !== "other" || otherReason.trim().length > 0;
    const customerReplacementOk =
      reason !== "customer_replacement" ||
      (customerPhoneError === "" && customerAddress.trim().length > 0);
    return (
      name.trim().length > 0 &&
      selectedProductId !== "" &&
      quantityError === "" &&
      priceError === "" &&
      unit !== "" &&
      reason !== "" &&
      otherReasonOk &&
      customerReplacementOk
    );
  }, [
    name,
    selectedProductId,
    quantityError,
    priceError,
    unit,
    reason,
    otherReason,
    customerPhoneError,
    customerAddress,
  ]);

  const refreshList = () =>
    fetchWastage(
      appliedStart,
      appliedEnd,
      paginationModel.page,
      paginationModel.pageSize,
    );

  const resetForm = () => {
    setName("");
    setSelectedProductId("");
    setQuantity("");
    setQuantityTouched(false);
    setUnit("");
    setPrice("");
    setPriceTouched(false);
    setReason("expired");
    setOtherReason("");
    setCustomerPhone("");
    setCustomerPhoneTouched(false);
    setCustomerAddress("");
    setWastageDate(getTodayIso());
  };

  const handleClose = () => {
    if (!submitting) {
      setDialogOpen(false);
      setEditingId(null);
      resetForm();
    }
  };

  const openAddDialog = () => {
    setEditingId(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = useCallback((record: WastageRecord) => {
    const { reason: formReason, otherReason: formOther } = reasonToFormFields(
      record.reason,
    );
    setEditingId(record._id ?? record.id);
    setName(record.name);
    setSelectedProductId(record.productId);
    setQuantity(String(record.quantity));
    setQuantityTouched(false);
    setUnit(record.unit);
    setPrice(String(record.price));
    setPriceTouched(false);
    setReason(formReason);
    setOtherReason(formOther);
    setCustomerPhone((record.customerPhone ?? "").replace(/\D/g, "").slice(0, 10));
    setCustomerPhoneTouched(false);
    setCustomerAddress(record.customerAddress ?? "");
    setWastageDate(recordDateKey(record.date) || getTodayIso());
    setDialogOpen(true);
  }, []);

  const handleSubmit = async () => {
    const selectedProduct = products.find((p) => p.id === selectedProductId);
    const resolvedReason =
      reason === "other" ? otherReason.trim() : reason;

    const payload = {
      outletId,
      name: name.trim(),
      productId: selectedProductId,
      productName: selectedProduct?.name ?? name.trim(),
      quantity: Number(quantity),
      unit,
      price: Number(price),
      reason: resolvedReason,
      date: wastageDate,
      ...(reason === "customer_replacement"
        ? {
            customerPhone: customerPhone.replace(/\D/g, ""),
            customerAddress: customerAddress.trim(),
          }
        : {}),
    };

    setSubmitting(true);
    try {
      const url = editingId
        ? `${API_BASE_URL}/wastage/${editingId}`
        : `${API_BASE_URL}/wastage`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: getApiHeaders(),
        body: JSON.stringify(
          editingId ? payload : { ...payload, status: "pending" },
        ),
      });

      if (res.ok) {
        notification.open?.({
          type: "success",
          message: editingId ? "Wastage updated" : "Wastage recorded",
          description: `${payload.name} — ${payload.quantity} ${payload.unit}`,
        });
        setDialogOpen(false);
        setEditingId(null);
        resetForm();
        await refreshList();
      } else {
        notification.open?.({
          type: "error",
          message: editingId ? "Not updated" : "Not saved",
          description: "Server returned an error.",
        });
      }
    } catch {
      notification.open?.({
        type: "error",
        message: "Could not reach server",
        description: "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: WastageRecord) => {
    const id = record._id ?? record.id;
    setDeletingId(record.id);
    try {
      const res = await fetch(`${API_BASE_URL}/wastage/${id}`, {
        method: "DELETE",
        headers: getApiHeaders(),
      });

      if (res.ok) {
        notification.open?.({
          type: "success",
          message: "Wastage deleted",
          description: record.name,
        });
        await refreshList();
      } else {
        notification.open?.({
          type: "error",
          message: "Could not delete",
          description: "Server returned an error.",
        });
      }
    } catch {
      notification.open?.({
        type: "error",
        message: "Could not reach server",
        description: "Please try again.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleAccept = async (record: WastageRecord) => {
    setAcceptingId(record.id);
    try {
      const id = record._id ?? record.id;
      const res = await fetch(`${API_BASE_URL}/wastage/${id}/accept`, {
        method: "PATCH",
        headers: getApiHeaders(),
      });

      if (res.ok) {
        notification.open?.({
          type: "success",
          message: "Wastage accepted",
          description: `Stock reduced for ${record.productName}.`,
        });
        await refreshList();
      } else {
        notification.open?.({
          type: "error",
          message: "Could not accept",
          description: "Server returned an error.",
        });
      }
    } catch {
      notification.open?.({
        type: "error",
        message: "Could not reach server",
        description: "Please try again.",
      });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleReject = async (record: WastageRecord) => {
    setRejectingId(record.id);
    try {
      const id = record._id ?? record.id;
      const res = await fetch(`${API_BASE_URL}/wastage/${id}/reject`, {
        method: "PATCH",
        headers: getApiHeaders(),
      });

      if (res.ok) {
        notification.open?.({
          type: "success",
          message: "Wastage rejected",
          description: `${record.name} has been rejected.`,
        });
        await refreshList();
      } else {
        notification.open?.({
          type: "error",
          message: "Could not reject",
          description: "Server returned an error.",
        });
      }
    } catch {
      notification.open?.({
        type: "error",
        message: "Could not reach server",
        description: "Please try again.",
      });
    } finally {
      setRejectingId(null);
    }
  };

  const columns = useMemo<GridColDef<WastageRecord>[]>(
    () => [
      {
        field: "date",
        headerName: "Date",
        flex: 0.9,
        minWidth: 110,
        valueGetter: (_value, row) => recordDateKey(row.date),
        renderCell: (params) => (
          <Typography variant="body2">
            {formatDateLabel(recordDateKey(params.row.date))}
          </Typography>
        ),
      },
      {
        field: "name",
        headerName: "Name",
        flex: 1,
        minWidth: 150,
        renderCell: (params) => (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="body2">{params.row.name}</Typography>
            {params.row.reason === "customer_replacement" ? (
              <Tooltip
                title={
                  <Stack spacing={0.5} sx={{ py: 0.25 }}>
                    <Typography variant="body2">
                      <strong>Phone:</strong>{" "}
                      {params.row.customerPhone?.trim() || "—"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Address:</strong>{" "}
                      {params.row.customerAddress?.trim() || "—"}
                    </Typography>
                  </Stack>
                }
                arrow
                placement="top"
              >
                <IconButton
                  size="small"
                  color="info"
                  aria-label="Customer replacement details"
                  sx={{ p: 0.25 }}
                >
                  <InfoOutlinedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
        ),
      },
      {
        field: "productName",
        headerName: "Product",
        flex: 1.2,
        minWidth: 140,
      },
      {
        field: "quantity",
        headerName: "Quantity",
        flex: 0.7,
        minWidth: 100,
        renderCell: (params) => (
          <Typography variant="body2">
            {params.row.quantity} {params.row.unit}
          </Typography>
        ),
      },
      {
        field: "price",
        headerName: "Price (₹)",
        flex: 0.7,
        minWidth: 100,
        renderCell: (params) => (
          <Typography variant="body2">
            ₹{Number(params.row.price).toFixed(2)}
          </Typography>
        ),
      },
      {
        field: "reason",
        headerName: "Reason",
        flex: 0.9,
        minWidth: 110,
        renderCell: (params) => {
          const label =
            WASTAGE_REASONS.find((r) => r.value === params.row.reason)?.label ??
            params.row.reason;
          return <Typography variant="body2">{label}</Typography>;
        },
      },
      {
        field: "status",
        headerName: "Status",
        flex: 0.7,
        minWidth: 110,
        renderCell: (params) =>
          params.row.status === "accepted" ? (
            <Chip label="Accepted" color="success" size="small" />
          ) : params.row.status === "rejected" ? (
            <Chip label="Rejected" color="error" size="small" />
          ) : (
            <Chip label="Pending" color="warning" size="small" />
          ),
      },
      {
        field: "actions",
        headerName: "Action",
        sortable: false,
        filterable: false,
        minWidth: 200,
        flex: 0.8,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => {
          if (params.row.status !== "pending") return null;
          const isAccepting = acceptingId === params.row.id;
          const isRejecting = rejectingId === params.row.id;
          const isDeleting = deletingId === params.row.id;
          const busy = isAccepting || isRejecting || isDeleting;
          return (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Edit">
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    aria-label="Edit wastage"
                    disabled={busy}
                    onClick={() => openEditDialog(params.row)}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Delete">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label="Delete wastage"
                    disabled={busy}
                    onClick={() =>
                      setConfirmAction({ type: "delete", record: params.row })
                    }
                  >
                    {isDeleting ? (
                      <CircularProgress size={16} color="error" />
                    ) : (
                      <DeleteOutlineIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Accept">
                <span>
                  <IconButton
                    size="small"
                    color="success"
                    aria-label="Accept wastage"
                    disabled={busy}
                    onClick={() => setConfirmAction({ type: "accept", record: params.row })}
                  >
                    {isAccepting ? (
                      <CircularProgress size={16} />
                    ) : (
                      <CheckCircleOutlineIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Reject">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label="Reject wastage"
                    disabled={busy}
                    onClick={() => setConfirmAction({ type: "reject", record: params.row })}
                  >
                    {isRejecting ? (
                      <CircularProgress size={16} color="error" />
                    ) : (
                      <CancelOutlinedIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    [acceptingId, rejectingId, deletingId, openEditDialog],
  );

  const dateRangeInvalid = Boolean(startDate && endDate && startDate > endDate);
  const dateRangeTooLong = Boolean(
    startDate && endDate && isDateRangeOverMaxDays(startDate, endDate),
  );
  const dateFilterBlocked = dateRangeInvalid || dateRangeTooLong;

  const maxEndForStart = startDate ? addDays(startDate, MAX_DATE_RANGE_DAYS - 1) : undefined;
  const minStartForEnd = endDate ? addDays(endDate, -(MAX_DATE_RANGE_DAYS - 1)) : undefined;

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
        Wastage Details
      </Typography>
      <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
        <TextField
          type="date"
          size="small"
          value={startDate}
          onChange={(e) => {
            const next = e.target.value;
            setStartDate(next);
            if (!next || !endDate) return;
            if (endDate < next) setEndDate(next);
            else if (isDateRangeOverMaxDays(next, endDate)) {
              setEndDate(addDays(next, MAX_DATE_RANGE_DAYS - 1));
            }
          }}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              max: endDate || undefined,
              min: minStartForEnd,
            },
          }}
          label="From"
          sx={{ minWidth: 150 }}
          error={dateFilterBlocked}
          helperText={dateRangeTooLong ? `Max ${MAX_DATE_RANGE_DAYS} days` : undefined}
        />
        <TextField
          type="date"
          size="small"
          value={endDate}
          onChange={(e) => {
            const next = e.target.value;
            setEndDate(next);
            if (!next || !startDate) return;
            if (next < startDate) setStartDate(next);
            else if (isDateRangeOverMaxDays(startDate, next)) {
              setStartDate(addDays(next, -(MAX_DATE_RANGE_DAYS - 1)));
            }
          }}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              min: startDate || undefined,
              max: maxEndForStart,
            },
          }}
          label="To"
          sx={{ minWidth: 150 }}
          error={dateFilterBlocked}
        />
        <Button
          variant="outlined"
          onClick={handleApplyDateRange}
          disabled={dateFilterBlocked || listLoading || !startDate || !endDate}
        >
          Apply
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAddDialog}
        >
          Add Wastage
        </Button>
      </Stack>
    </Stack>
  );

  if (listLoading && rows.length === 0 && !listError) {
    return (
      <>
        {header}
        <Box display="flex" justifyContent="center" py={5}>
          <CircularProgress size={36} />
        </Box>
      </>
    );
  }

  if (listError) {
    return (
      <>
        {header}
        <Typography color="error" sx={{ py: 2 }}>
          Could not load wastage records. Try again later.
        </Typography>
      </>
    );
  }

  return (
    <>
      {header}

      {rows.length === 0 ? (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          gap={2}
          sx={{ py: 10 }}
        >
          <Typography color="text.secondary" variant="body1">
            No wastage records for this date range.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openAddDialog}
          >
            Add Wastage
          </Button>
        </Box>
      ) : (
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <DataGrid
            rows={rows}
            columns={columns}
            disableRowSelectionOnClick
            loading={listLoading}
            paginationMode="server"
            rowCount={rowCount}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[10, 25, 50]}
            sx={{
              minWidth: 720,
              width: "100%",
              height: 560,
              "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 600 },
              "& .MuiDataGrid-cell": { alignItems: "center", display: "flex" },
            }}
          />
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={(_e, reason) => { if (reason !== "backdropClick") handleClose(); }} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Edit Wastage" : "Add Wastage"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
              required
              placeholder="e.g. Morning batch milk"
            />

            <TextField
              select
              label="Product"
              value={selectedProductId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedProductId(id);
                const p = products.find((x) => x.id === id);
                setUnit(p?.unit ?? "");
                if (!editingId) {
                  setQuantity(id ? "1" : "");
                  setQuantityTouched(false);
                }
              }}
              fullWidth
              size="small"
              required
            >
              {products.length === 0 ? (
                <MenuItem disabled value="">
                  Loading products…
                </MenuItem>
              ) : (
                products.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                    {p.unit ? ` (${p.unit})` : ""}
                  </MenuItem>
                ))
              )}
            </TextField>

            <Stack direction="row" spacing={1.5}>
              <TextField
                label="Quantity"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setQuantityTouched(true);
                }}
                onBlur={() => setQuantityTouched(true)}
                type="number"
                fullWidth
                size="small"
                required
                disabled={!selectedProductId}
                placeholder={selectedProductId ? undefined : "Select product first"}
                error={quantityTouched && quantityError !== ""}
                helperText={
                  quantityTouched && quantityError ? quantityError : undefined
                }
                slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
              />

              <TextField
                label="Unit"
                value={unit}
                size="small"
                sx={{ minWidth: 110 }}
                slotProps={{
                  input: { readOnly: true },
                  inputLabel: { shrink: unit !== "" ? true : undefined },
                }}
                placeholder="—"
              />
            </Stack>

            <TextField
              label="Price (₹)"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setPriceTouched(true);
              }}
              onBlur={() => setPriceTouched(true)}
              type="number"
              fullWidth
              size="small"
              required
              error={priceTouched && priceError !== ""}
              helperText={
                priceTouched && priceError ? priceError : undefined
              }
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
            />

            <TextField
              label="Date"
              type="date"
              value={wastageDate}
              onChange={(e) => setWastageDate(e.target.value)}
              fullWidth
              size="small"
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <TextField
              select
              label="Reason"
              value={reason}
              onChange={(e) => {
                const next = e.target.value;
                setReason(next);
                if (next !== "other") setOtherReason("");
                if (next !== "customer_replacement") {
                  setCustomerPhone("");
                  setCustomerPhoneTouched(false);
                  setCustomerAddress("");
                }
              }}
              fullWidth
              size="small"
              required
            >
              {WASTAGE_REASONS.map((r) => (
                <MenuItem key={r.value} value={r.value}>
                  {r.label}
                </MenuItem>
              ))}
            </TextField>

            {reason === "other" && (
              <TextField
                label="Specify reason"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                fullWidth
                size="small"
                required
                autoFocus
                placeholder="Describe the reason…"
              />
            )}

            {reason === "customer_replacement" && (
              <>
                <TextField
                  label="Phone Number"
                  value={customerPhone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setCustomerPhone(digits);
                    setCustomerPhoneTouched(true);
                  }}
                  onBlur={() => setCustomerPhoneTouched(true)}
                  fullWidth
                  size="small"
                  required
                  autoFocus
                  placeholder="10-digit phone number"
                  error={customerPhoneTouched && customerPhoneError !== ""}
                  helperText={
                    customerPhoneTouched && customerPhoneError
                      ? customerPhoneError
                      : "Max 10 digits"
                  }
                  slotProps={{
                    htmlInput: { inputMode: "numeric", maxLength: 10 },
                  }}
                />
                <TextField
                  label="Address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  fullWidth
                  size="small"
                  required
                  multiline
                  minRows={2}
                  placeholder="Customer address"
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting || !formValid}
          >
            {submitting ? "Saving…" : editingId ? "Update" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {confirmAction?.type === "accept"
            ? "Accept Wastage?"
            : confirmAction?.type === "reject"
              ? "Reject Wastage?"
              : "Delete Wastage?"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {confirmAction?.type === "accept" ? (
              <>
                Are you sure you want to <strong>accept</strong> wastage for{" "}
                <strong>{confirmAction.record.productName}</strong>? This will
                reduce the stock by{" "}
                <strong>
                  {confirmAction.record.quantity} {confirmAction.record.unit}
                </strong>.
              </>
            ) : confirmAction?.type === "reject" ? (
              <>
                Are you sure you want to <strong>reject</strong> wastage for{" "}
                <strong>{confirmAction.record.productName}</strong>? No stock
                will be deducted.
              </>
            ) : (
              <>
                Are you sure you want to <strong>delete</strong>{" "}
                <strong>{confirmAction?.record.name}</strong>? This cannot be
                undone.
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmAction(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={
              confirmAction?.type === "accept"
                ? "success"
                : "error"
            }
            onClick={() => {
              if (!confirmAction) return;
              const { type, record } = confirmAction;
              setConfirmAction(null);
              if (type === "accept") void handleAccept(record);
              else if (type === "reject") void handleReject(record);
              else void handleDelete(record);
            }}
          >
            {confirmAction?.type === "accept"
              ? "Yes, Accept"
              : confirmAction?.type === "reject"
                ? "Yes, Reject"
                : "Yes, Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
