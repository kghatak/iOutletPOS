import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { keys, useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useLocation } from "react-router";
import { useOutlet } from "../../context/outlet-context";
import { API_BASE_URL } from "../../config";
import { getApiHeaders } from "../../providers/authProvider";
import type { ExpenseCategoryValue, ExpensePaidFromValue, ExpenseRecord } from "../../types/expense";
import { EXPENSE_CATEGORIES, EXPENSE_PAID_FROM_OPTIONS, formatRupee } from "../../types/expense";
import {
  buildExpenseViewGridRows,
  buildExpensesListPath,
  filterExpenseRecordsByDateKey,
  toDateLabel,
  type DateWiseExpenseRow,
  type EditableExpenseRow,
  type ExpenseViewGridRow,
  type ExpenseViewLocationState,
  getRecordAmount,
  toEditableExpenseRows,
} from "./expense-helpers";

function normalizeExpenseList(json: unknown): ExpenseRecord[] {
  if (Array.isArray(json)) return json as ExpenseRecord[];
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  const nested = o.data ?? o.items ?? o.results;
  if (Array.isArray(nested)) return nested as ExpenseRecord[];
  return [];
}

export const ExpenseDateViewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const notification = useNotification();
  const { outletId } = useOutlet();
  const { dateKey: dateKeyParam } = useParams<{ dateKey: string }>();
  const dateKey = dateKeyParam ? decodeURIComponent(dateKeyParam) : "";

  const expensesListSearch =
    (location.state as ExpenseViewLocationState | null)?.expensesListSearch ?? "";

  const goBackToExpenses = useCallback(() => {
    if (expensesListSearch) {
      navigate(buildExpensesListPath(expensesListSearch));
      return;
    }
    navigate(-1);
  }, [navigate, expensesListSearch]);

  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadExpensesForDate = useCallback(async () => {
    if (!dateKey || !outletId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const qs = new URLSearchParams({
        outletId,
        date: dateKey,
      });
      const res = await fetch(`${API_BASE_URL}/expenses?${qs.toString()}`, {
        headers: getApiHeaders(),
      });
      if (!res.ok) {
        setLoadError(true);
        setRecords([]);
        return;
      }
      const json = await res.json();
      setRecords(filterExpenseRecordsByDateKey(normalizeExpenseList(json), dateKey));
    } catch {
      setLoadError(true);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [dateKey, outletId]);

  useEffect(() => {
    void loadExpensesForDate();
  }, [loadExpensesForDate]);

  const row: DateWiseExpenseRow | null = useMemo(() => {
    if (!dateKey) return null;
    if (loading) return null;
    if (records.length === 0) {
      return {
        id: dateKey,
        dateKey,
        dateLabel: toDateLabel(dateKey),
        totalAmount: 0,
        records: [],
      };
    }
    const totalAmount = records.reduce((sum, r) => sum + getRecordAmount(r), 0);
    return {
      id: dateKey,
      dateKey,
      dateLabel: toDateLabel(dateKey),
      totalAmount,
      records,
    };
  }, [dateKey, records, loading]);

  const viewGridRows = useMemo(() => buildExpenseViewGridRows(row), [row]);

  const editableForDate = useMemo(() => (row ? toEditableExpenseRows(row) : []), [row]);

  const viewTotalAmount = useMemo(
    () => (row?.records ?? []).reduce((sum, r) => sum + getRecordAmount(r), 0),
    [row],
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<EditableExpenseRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const closeDrawer = useCallback(() => {
    if (!saving) {
      setDrawerOpen(false);
      setEditDraft(null);
    }
  }, [saving]);

  const openEdit = useCallback(
    (gridRow: ExpenseViewGridRow) => {
      const src = editableForDate[gridRow.rowIndex];
      if (!src) return;
      if (!src.canEdit) {
        notification.open?.({
          type: "error",
          message: "Not editable",
          description: "This expense has no server id and cannot be edited.",
        });
        return;
      }
      setEditDraft({ ...src });
      setDrawerOpen(true);
    },
    [editableForDate, notification],
  );

  const editValid = useMemo(() => {
    if (!editDraft) return false;
    const p = Number(editDraft.amount);
    const amountOk = Number.isFinite(p) && p > 0;
    const otherOk = editDraft.expenseType !== "other" || editDraft.otherLabel.trim().length > 0;
    return amountOk && otherOk && Boolean(editDraft.date?.trim());
  }, [editDraft]);

  const hasChanges = useMemo(() => {
    if (!editDraft) return false;
    return (
      editDraft.expenseType !== editDraft.originalExpenseType ||
      editDraft.otherLabel.trim() !== editDraft.originalOtherLabel.trim() ||
      editDraft.amount.trim() !== editDraft.originalAmount ||
      editDraft.paidFrom !== editDraft.originalPaidFrom ||
      editDraft.date !== editDraft.originalDate ||
      editDraft.employee.trim() !== editDraft.originalEmployee.trim() ||
      editDraft.remarks.trim() !== editDraft.originalRemarks.trim()
    );
  }, [editDraft]);

  const saveEdit = async () => {
    if (!editDraft?.canEdit || !editValid || !hasChanges) return;

    const draft = editDraft;
    if (draft.amount.trim() !== draft.originalAmount) {
      const parsedAmount = Number(draft.amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        notification.open?.({
          type: "error",
          message: "Invalid amount",
          description: "Amount must be a positive number.",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, string | number> = {};
      if (
        draft.expenseType !== draft.originalExpenseType ||
        draft.otherLabel.trim() !== draft.originalOtherLabel.trim()
      ) {
        payload.type = draft.expenseType;
        payload.categoryLabel =
          draft.expenseType === "other"
            ? draft.otherLabel.trim()
            : EXPENSE_CATEGORIES.find((t) => t.value === draft.expenseType)?.label ?? draft.expenseType;
      }
      if (draft.amount.trim() !== draft.originalAmount) {
        payload.amount = Number(draft.amount);
      }
      if (draft.date !== draft.originalDate) {
        payload.date = draft.date;
      }
      if (draft.paidFrom !== draft.originalPaidFrom) {
        payload.paidFrom =
          EXPENSE_PAID_FROM_OPTIONS.find((o) => o.value === draft.paidFrom)?.label ?? draft.paidFrom;
      }
      if (draft.employee.trim() !== draft.originalEmployee.trim()) {
        payload.employee = draft.employee.trim();
      }
      if (draft.remarks.trim() !== draft.originalRemarks.trim()) {
        payload.remarks = draft.remarks.trim();
      }
      if (outletId) {
        payload.outletId = outletId;
      }

      const patchBodyKeys = Object.keys(payload).filter((k) => k !== "outletId");
      if (patchBodyKeys.length === 0) {
        closeDrawer();
        return;
      }

      const res = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(draft.expenseId)}`, {
        method: "PATCH",
        headers: getApiHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        notification.open?.({
          type: "success",
          message: "Expense updated",
        });
        await queryClient.invalidateQueries({
          queryKey: keys().data().resource("expenses").action("list").get(),
        });
        await loadExpensesForDate();
        closeDrawer();
      } else {
        notification.open?.({
          type: "error",
          message: "Update failed",
          description: `Server returned ${res.status}.`,
        });
      }
    } catch {
      notification.open?.({
        type: "error",
        message: "Could not save",
        description: "Request failed. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(
    async (expenseId: string) => {
      if (!expenseId || !row) return;
      if (!window.confirm("Delete this expense? This cannot be undone.")) {
        return;
      }
      const wasOnlyRecord = row.records.length === 1;
      setDeletingId(expenseId);
      try {
        const res = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(expenseId)}`, {
          method: "DELETE",
          headers: getApiHeaders(),
        });
        if (res.ok) {
          notification.open?.({
            type: "success",
            message: "Expense deleted",
          });
          if (drawerOpen && editDraft?.expenseId === expenseId) {
            closeDrawer();
          }
          await queryClient.invalidateQueries({
            queryKey: keys().data().resource("expenses").action("list").get(),
          });
          await loadExpensesForDate();
          if (wasOnlyRecord) {
            navigate(buildExpensesListPath(expensesListSearch), { replace: true });
          }
        } else {
          notification.open?.({
            type: "error",
            message: "Delete failed",
            description: `Server returned ${res.status}.`,
          });
        }
      } catch {
        notification.open?.({
          type: "error",
          message: "Could not delete",
          description: "Request failed. Please try again.",
        });
      } finally {
        setDeletingId(null);
      }
    },
    [row, navigate, notification, queryClient, drawerOpen, editDraft?.expenseId, closeDrawer, loadExpensesForDate, expensesListSearch],
  );

  const viewGridColumns = useMemo<GridColDef<ExpenseViewGridRow>[]>(
    () => [
      {
        field: "series",
        headerName: "Series",
        width: 72,
        align: "center",
        headerAlign: "center",
      },
      {
        field: "expenseDate",
        headerName: "Expense Date",
        flex: 0.85,
        minWidth: 118,
      },
      {
        field: "expenseType",
        headerName: "Expense Type",
        flex: 1.1,
        minWidth: 140,
        renderCell: (p) => (
          <Typography variant="body2" noWrap title={p.value as string}>
            {p.value as string}
          </Typography>
        ),
      },
      {
        field: "amount",
        headerName: "Amount",
        flex: 0.7,
        minWidth: 100,
        align: "right",
        headerAlign: "right",
        renderCell: (params) => (
          <Typography variant="body2" sx={{ width: "100%", textAlign: "right" }}>
            {formatRupee(params.row.amount)}
          </Typography>
        ),
      },
      {
        field: "paidFromLabel",
        headerName: "Paid From",
        flex: 0.85,
        minWidth: 110,
      },
      {
        field: "employee",
        headerName: "Employee Name",
        flex: 0.95,
        minWidth: 110,
        renderCell: (p) => (
          <Typography variant="body2" noWrap title={p.value as string}>
            {p.value as string}
          </Typography>
        ),
      },
      {
        field: "remarks",
        headerName: "Remarks",
        flex: 1.15,
        minWidth: 120,
        renderCell: (p) => (
          <Typography variant="body2" noWrap title={p.value as string}>
            {p.value as string}
          </Typography>
        ),
      },
      {
        field: "actions",
        headerName: "Action",
        sortable: false,
        filterable: false,
        width: 108,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => {
          const editable = editableForDate[params.row.rowIndex];
          const canEdit = Boolean(editable?.canEdit);
          return (
            <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center" width="100%">
              <Tooltip title="Edit">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Edit expense"
                    disabled={!canEdit || Boolean(deletingId)}
                    onClick={() => openEdit(params.row)}
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
                    aria-label="Delete expense"
                    disabled={!canEdit || deletingId === editable?.expenseId}
                    onClick={() => editable?.expenseId && handleDelete(editable.expenseId)}
                  >
                    {deletingId === editable?.expenseId ? (
                      <CircularProgress color="inherit" size={18} />
                    ) : (
                      <DeleteOutlineIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    [deletingId, editableForDate, openEdit, handleDelete],
  );

  const rowAmountError =
    editDraft && editDraft.canEdit
      ? (() => {
          const t = editDraft.amount.trim();
          if (!t) return "Amount is required.";
          const n = Number(editDraft.amount);
          if (!Number.isFinite(n) || n <= 0) return "Enter a positive number.";
          return "";
        })()
      : "";

  const header = (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      flexWrap="wrap"
      gap={2}
      sx={{ mb: 2 }}
    >
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
        <Button startIcon={<ArrowBackIcon />} onClick={goBackToExpenses} size="small">
          Expenses
        </Button>
        <Typography variant="h5" component="h1">
          View expenses — {row?.dateLabel ?? "—"}
        </Typography>
      </Stack>
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

  if (loadError) {
    return (
      <>
        {header}
        <Typography color="error" sx={{ py: 2 }}>
          Could not load expenses. Try again later.
        </Typography>
      </>
    );
  }

  if (!dateKey || !row) {
    return (
      <>
        {header}
        <Typography color="text.secondary" sx={{ py: 2 }}>
          No expenses found for this date.
        </Typography>
        <Button variant="outlined" onClick={goBackToExpenses}>
          Back to expenses
        </Button>
      </>
    );
  }

  const viewingRow = row;

  return (
    <>
      {header}
      {viewingRow.records.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          No expenses found for this date.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          <DataGrid
            rows={viewGridRows}
            columns={viewGridColumns}
            disableRowSelectionOnClick
            hideFooter
            pageSizeOptions={[10]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            sx={{
              "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 600 },
              "& .MuiDataGrid-cell": { alignItems: "center", display: "flex" },
            }}
            autoHeight
          />
          <Typography variant="subtitle1" fontWeight={600} sx={{ textAlign: "right" }}>
            Total: {formatRupee(viewTotalAmount)}
          </Typography>
        </Stack>
      )}

      <Drawer anchor="right" open={drawerOpen} onClose={closeDrawer}>
        <Box
          sx={{
            width: { xs: "100vw", sm: 400 },
            maxWidth: "100vw",
            p: 2,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            height: "100%",
            boxSizing: "border-box",
          }}
        >
          <Typography variant="h6" component="h2">
            Edit expense
          </Typography>
          {editDraft ? (
            <>
              <TextField
                select
                label="Expense type"
                value={editDraft.expenseType}
                onChange={(e) =>
                  setEditDraft((d) =>
                    d
                      ? {
                          ...d,
                          expenseType: e.target.value as ExpenseCategoryValue,
                          otherLabel: e.target.value === "other" ? d.otherLabel : "",
                        }
                      : d,
                  )
                }
                size="small"
                fullWidth
                disabled={!editDraft.canEdit || saving}
              >
                {EXPENSE_CATEGORIES.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>

              {editDraft.expenseType === "other" ? (
                <TextField
                  label="Expense name"
                  value={editDraft.otherLabel}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, otherLabel: e.target.value } : d))}
                  size="small"
                  fullWidth
                  required
                  disabled={!editDraft.canEdit || saving}
                />
              ) : null}

              <TextField
                label="Amount (₹)"
                value={editDraft.amount}
                onChange={(e) => setEditDraft((d) => (d ? { ...d, amount: e.target.value } : d))}
                type="number"
                size="small"
                fullWidth
                required
                disabled={!editDraft.canEdit || saving}
                error={Boolean(rowAmountError)}
                helperText={rowAmountError || undefined}
                slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
              />

              <TextField
                select
                label="Paid from"
                value={editDraft.paidFrom}
                onChange={(e) =>
                  setEditDraft((d) =>
                    d ? { ...d, paidFrom: e.target.value as ExpensePaidFromValue } : d,
                  )
                }
                size="small"
                fullWidth
                required
                disabled={!editDraft.canEdit || saving}
              >
                {EXPENSE_PAID_FROM_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Expense date"
                value={editDraft.date}
                onChange={(e) => setEditDraft((d) => (d ? { ...d, date: e.target.value } : d))}
                type="date"
                size="small"
                fullWidth
                required
                disabled={!editDraft.canEdit || saving}
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <TextField
                label="Employee Name (optional)"
                value={editDraft.employee}
                onChange={(e) => setEditDraft((d) => (d ? { ...d, employee: e.target.value } : d))}
                size="small"
                fullWidth
                disabled={!editDraft.canEdit || saving}
              />

              <TextField
                label="Remarks"
                value={editDraft.remarks}
                onChange={(e) => setEditDraft((d) => (d ? { ...d, remarks: e.target.value } : d))}
                size="small"
                fullWidth
                multiline
                minRows={2}
                disabled={!editDraft.canEdit || saving}
              />

              <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: "auto", pt: 1 }}>
                <Button onClick={closeDrawer} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={saveEdit}
                  disabled={saving || !editValid || !hasChanges}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </Stack>
            </>
          ) : null}
        </Box>
      </Drawer>
    </>
  );
};
