import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import IconButton from "@mui/material/IconButton";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { keys, useList, useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { useOutlet } from "../../context/outlet-context";
import { API_BASE_URL } from "../../config";
import { getApiHeaders } from "../../providers/authProvider";
import type { ExpenseCategoryValue, ExpenseGridRow, ExpenseRecord } from "../../types/expense";
import {
  EXPENSE_CATEGORIES,
  expenseRecordsToGridRows,
  formatRupee,
  getExpenseApiId,
  getExpenseRowId,
} from "../../types/expense";

function getTodayDateInputValue(): string {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

type DateWiseExpenseRow = {
  id: string;
  dateKey: string;
  dateLabel: string;
  totalAmount: number;
  records: ExpenseRecord[];
};

type EditableExpenseRow = {
  id: string;
  expenseId: string;
  categoryLabel: string;
  amount: string;
  date: string;
  originalCategoryLabel: string;
  originalAmount: string;
  originalDate: string;
  canEdit: boolean;
};

function getRecordAmount(record: ExpenseRecord): number {
  const value = record.amount ?? record.Amount;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

function getRecordCategoryLabel(record: ExpenseRecord): string {
  if (typeof record.categoryLabel === "string" && record.categoryLabel.trim()) {
    return record.categoryLabel.trim();
  }
  if (typeof record.category === "string" && record.category.trim()) {
    return record.category.trim();
  }
  if (typeof record.name === "string" && record.name.trim()) {
    return record.name.trim();
  }
  const fallback = EXPENSE_CATEGORIES.find((c) => c.value === record.type)?.label;
  return fallback ?? (typeof record.type === "string" && record.type.trim() ? record.type.trim() : "—");
}

function getRecordDateSource(record: ExpenseRecord): string {
  return record.date ?? record.createdAt ?? record.CreatedAt ?? "";
}

function toDateKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  const tzOffsetMs = parsed.getTimezoneOffset() * 60 * 1000;
  return new Date(parsed.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

function toDateLabel(dateKey: string): string {
  if (!dateKey) return "Undated";
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getRecordDateLabel(record: ExpenseRecord): string {
  const raw = getRecordDateSource(record);
  if (!raw) return "—";
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const localDate = new Date(year, month - 1, day);
    if (Number.isNaN(localDate.getTime())) return raw;
    return localDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const ExpensePage = () => {
  const queryClient = useQueryClient();
  const notification = useNotification();
  const { outletId } = useOutlet();

  const listQuery = useList<ExpenseRecord>({
    resource: "expenses",
    pagination: { mode: "off" },
    errorNotification: false,
    queryOptions: { staleTime: 30 * 1000 },
  });

  const dateWiseRows = useMemo<DateWiseExpenseRow[]>(() => {
    const grouped = new Map<string, DateWiseExpenseRow>();
    for (const record of listQuery.result?.data ?? []) {
      const dateKey = toDateKey(getRecordDateSource(record));
      const id = dateKey || "undated";
      const existing = grouped.get(id);
      if (existing) {
        existing.totalAmount += getRecordAmount(record);
        existing.records.push(record);
      } else {
        grouped.set(id, {
          id,
          dateKey,
          dateLabel: toDateLabel(dateKey),
          totalAmount: getRecordAmount(record),
          records: [record],
        });
      }
    }
    return Array.from(grouped.values()).sort((a, b) => {
      if (!a.dateKey && !b.dateKey) return 0;
      if (!a.dateKey) return 1;
      if (!b.dateKey) return -1;
      return b.dateKey.localeCompare(a.dateKey);
    });
  }, [listQuery.result?.data]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [expenseType, setExpenseType] = useState<ExpenseCategoryValue>("electricity");
  const [otherLabel, setOtherLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(getTodayDateInputValue());
  const [submitting, setSubmitting] = useState(false);
  const [viewingRow, setViewingRow] = useState<DateWiseExpenseRow | null>(null);
  const [editingRow, setEditingRow] = useState<DateWiseExpenseRow | null>(null);
  const [editableRecords, setEditableRecords] = useState<EditableExpenseRow[]>([]);
  const [savingEdits, setSavingEdits] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  const resetForm = () => {
    setExpenseType("electricity");
    setOtherLabel("");
    setAmount("");
    setExpenseDate(getTodayDateInputValue());
  };

  const handleClose = () => {
    if (!submitting) {
      setDialogOpen(false);
      resetForm();
    }
  };

  const handleSubmit = async () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      notification.open?.({
        type: "error",
        message: "Invalid amount",
        description: "Enter a positive number.",
      });
      return;
    }

    if (expenseType === "other" && !otherLabel.trim()) {
      notification.open?.({
        type: "error",
        message: "Name required",
        description: "Enter a name for this expense.",
      });
      return;
    }

    if (!expenseDate) {
      notification.open?.({
        type: "error",
        message: "Date required",
        description: "Choose the date when this expense was used.",
      });
      return;
    }

    const categoryLabel =
      expenseType === "other"
        ? otherLabel.trim()
        : EXPENSE_CATEGORIES.find((t) => t.value === expenseType)?.label ??
          expenseType;

    const payload = {
      outletId,
      type: expenseType,
      categoryLabel,
      amount: parsed,
      date: expenseDate,
    };

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/expenses`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        notification.open?.({
          type: "success",
          message: "Expense recorded",
          description: `${categoryLabel} — ₹${parsed.toFixed(2)}`,
        });
        setDialogOpen(false);
        resetForm();
        await queryClient.invalidateQueries({
          queryKey: keys().data().resource("expenses").action("list").get(),
        });
      } else {
        console.info("Expense payload (server returned non-OK):", payload);
        notification.open?.({
          type: "error",
          message: "Not saved",
          description:
            "The expenses API may not exist yet. Payload is in the console.",
        });
      }
    } catch {
      console.info("Expense payload (request failed):", payload);
      notification.open?.({
        type: "error",
        message: "Could not reach server",
        description: "Payload is in the console for debugging.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (row: DateWiseExpenseRow) => {
    setEditingRow(row);
    setEditableRecords(
      row.records.map((record, index) => {
        const expenseId = getExpenseApiId(record);
        const baseAmount = getRecordAmount(record);
        const baseCategory = getRecordCategoryLabel(record);
        const baseDate = toDateKey(getRecordDateSource(record)) || getTodayDateInputValue();
        return {
          id: `${getExpenseRowId(record, index)}-${index}`,
          expenseId,
          categoryLabel: baseCategory,
          amount: String(baseAmount),
          date: baseDate,
          originalCategoryLabel: baseCategory,
          originalAmount: String(baseAmount),
          originalDate: baseDate,
          canEdit: Boolean(expenseId),
        };
      }),
    );
  };

  const handleSaveEdits = async () => {
    const changedRows = editableRecords.filter(
      (r) =>
        r.canEdit &&
        (r.categoryLabel.trim() !== r.originalCategoryLabel ||
          r.amount.trim() !== r.originalAmount ||
          r.date !== r.originalDate),
    );

    if (changedRows.length === 0) {
      return;
    }

    for (const row of changedRows) {
      if (row.amount.trim() !== row.originalAmount) {
        const parsedAmount = Number(row.amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
          notification.open?.({
            type: "error",
            message: "Invalid amount",
            description: "Amount must be a positive number.",
          });
          return;
        }
      }
      if (row.date !== row.originalDate && !row.date) {
        notification.open?.({
          type: "error",
          message: "Date required",
          description: "Choose a valid date.",
        });
        return;
      }
    }

    setSavingEdits(true);
    try {
      let successCount = 0;
      for (const row of changedRows) {
        const payload: Record<string, string | number> = {};
        if (row.categoryLabel.trim() !== row.originalCategoryLabel) {
          payload.categoryLabel = row.categoryLabel.trim();
        }
        if (row.amount.trim() !== row.originalAmount) {
          payload.amount = Number(row.amount);
        }
        if (row.date !== row.originalDate) {
          payload.date = row.date;
        }
        if (outletId) {
          payload.outletId = outletId;
        }

        const patchBodyKeys = Object.keys(payload).filter((k) => k !== "outletId");
        if (patchBodyKeys.length === 0) {
          continue;
        }

        const res = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(row.expenseId)}`, {
          method: "PATCH",
          headers: getApiHeaders(),
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          successCount += 1;
        } else {
          console.info("Expense edit payload (server returned non-OK):", {
            expenseId: row.expenseId,
            payload,
          });
        }
      }

      if (successCount > 0) {
        notification.open?.({
          type: "success",
          message: "Expenses updated",
          description: `${successCount} expense(s) updated.`,
        });
        setEditingRow(null);
        setEditableRecords([]);
        await queryClient.invalidateQueries({
          queryKey: keys().data().resource("expenses").action("list").get(),
        });
      } else {
        notification.open?.({
          type: "error",
          message: "Update failed",
          description: "Update failed. Payloads are logged in the console.",
        });
      }
    } catch {
      notification.open?.({
        type: "error",
        message: "Could not update expenses",
        description: "Request failed. Please try again.",
      });
    } finally {
      setSavingEdits(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!expenseId) return;
    if (
      !window.confirm(
        "Delete this expense? This cannot be undone.",
      )
    ) {
      return;
    }

    setDeletingExpenseId(expenseId);
    try {
      const res = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(expenseId)}`, {
        method: "DELETE",
        headers: getApiHeaders(),
      });

      if (res.ok) {
        notification.open?.({
          type: "success",
          message: "Expense deleted",
          description: "The expense was removed.",
        });
        setEditableRecords((prev) => {
          const next = prev.filter((r) => r.expenseId !== expenseId);
          if (next.length === 0) {
            setEditingRow(null);
          }
          return next;
        });
        await queryClient.invalidateQueries({
          queryKey: keys().data().resource("expenses").action("list").get(),
        });
        setViewingRow((prev) => {
          if (!prev) return null;
          const nextRecords = prev.records.filter((r) => {
            const id =
              typeof r.expenseId === "string" && r.expenseId.trim()
                ? r.expenseId.trim()
                : typeof r.id === "string" && r.id.trim()
                  ? r.id.trim()
                  : "";
            return id !== expenseId;
          });
          if (nextRecords.length === 0) return null;
          const totalAmount = nextRecords.reduce((sum, r) => sum + getRecordAmount(r), 0);
          return { ...prev, records: nextRecords, totalAmount };
        });
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
        message: "Could not delete expense",
        description: "Request failed. Please try again.",
      });
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const reportColumns = useMemo<GridColDef<DateWiseExpenseRow>[]>(
    () => [
      {
        field: "dateLabel",
        headerName: "Date",
        flex: 1.3,
        minWidth: 180,
      },
      {
        field: "totalAmount",
        headerName: "Total Expenses Reported",
        flex: 1,
        minWidth: 200,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => (
          <Typography variant="body2" sx={{ width: "100%", textAlign: "center" }}>
            {formatRupee(params.row.totalAmount)}
          </Typography>
        ),
      },
      {
        field: "actions",
        headerName: "Action",
        sortable: false,
        filterable: false,
        minWidth: 200,
        flex: 1,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={() => setViewingRow(params.row)}>
              View
            </Button>
            <Button size="small" variant="contained" onClick={() => handleOpenEdit(params.row)}>
              Edit
            </Button>
          </Stack>
        ),
      },
    ],
    [],
  );

  const viewRows = useMemo<ExpenseGridRow[]>(
    () => expenseRecordsToGridRows(viewingRow?.records ?? []),
    [viewingRow],
  );

  const viewTotalAmount = useMemo(
    () => viewRows.reduce((sum, r) => sum + r.amount, 0),
    [viewRows],
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
        Expenses
      </Typography>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setDialogOpen(true)}
      >
        Add Expense
      </Button>
    </Stack>
  );

  if (listQuery.query.isPending) {
    return (
      <>
        {header}
        <Box display="flex" justifyContent="center" py={5}>
          <CircularProgress size={36} />
        </Box>
      </>
    );
  }

  if (listQuery.query.isError) {
    return (
      <>
        {header}
        <Typography color="error" sx={{ py: 2 }}>
          Could not load expenses. Try again later.
        </Typography>
      </>
    );
  }

  return (
    <>
      {header}

      {dateWiseRows.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 3 }}>
          No expenses recorded yet.
        </Typography>
      ) : (
        <DataGrid
          rows={dateWiseRows}
          columns={reportColumns}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          sx={{
            "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 600 },
            "& .MuiDataGrid-cell": { alignItems: "center", display: "flex" },
          }}
          autoHeight
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add Expense</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Expense type"
              value={expenseType}
              onChange={(e) =>
                setExpenseType(e.target.value as ExpenseCategoryValue)
              }
              fullWidth
              size="small"
            >
              {EXPENSE_CATEGORIES.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            {expenseType === "other" ? (
              <TextField
                label="Expense name"
                value={otherLabel}
                onChange={(e) => setOtherLabel(e.target.value)}
                fullWidth
                size="small"
                required
                autoFocus
              />
            ) : null}

            <TextField
              label="Amount (₹)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              fullWidth
              size="small"
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
            />

            <TextField
              label="Expense date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              type="date"
              fullWidth
              size="small"
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(viewingRow)}
        onClose={() => setViewingRow(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          View Expenses - {viewingRow?.dateLabel ?? ""}
        </DialogTitle>
        <DialogContent>
          {viewRows.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              No expenses found for this date.
            </Typography>
          ) : (
            <Stack spacing={1.5} sx={{ mt: 0.5 }}>
              <DataGrid
                rows={viewRows}
                columns={[
                { field: "expenseId", headerName: "Expense ID", flex: 1, minWidth: 120 },
                { field: "category", headerName: "Category", flex: 1.4, minWidth: 150 },
                {
                  field: "amount",
                  headerName: "Amount",
                  flex: 1,
                  minWidth: 120,
                  align: "right",
                  headerAlign: "right",
                  renderCell: (params) => (
                    <Typography variant="body2" sx={{ width: "100%", textAlign: "right" }}>
                      {formatRupee(params.row.amount)}
                    </Typography>
                  ),
                },
                {
                  field: "createdAt",
                  headerName: "Date",
                  flex: 1.4,
                  minWidth: 190,
                  renderCell: (params) => {
                    const target = viewingRow?.records.find(
                      (record, idx) => getExpenseRowId(record, idx) === params.row.expenseId,
                    );
                    return (
                      <Typography variant="body2">
                        {target ? getRecordDateLabel(target) : params.row.createdAt}
                      </Typography>
                    );
                  },
                },
              ]}
                disableRowSelectionOnClick
                pageSizeOptions={[5, 10, 25]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 5 } },
                }}
                autoHeight
                sx={{
                  mt: 1,
                  "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 600 },
                }}
              />
              <Typography variant="subtitle1" fontWeight={600} sx={{ textAlign: "right" }}>
                Total: {formatRupee(viewTotalAmount)}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setViewingRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(editingRow)}
        onClose={() => {
          if (!savingEdits) {
            setEditingRow(null);
            setEditableRecords([]);
          }
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Edit Expenses - {editingRow?.dateLabel ?? ""}
        </DialogTitle>
        <DialogContent>
          {editableRecords.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              No editable expenses found for this date.
            </Typography>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {editableRecords.map((row) => (
                <Stack
                  key={row.id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "stretch", sm: "flex-start" }}
                >
                  <TextField
                    label="Expense name"
                    value={row.categoryLabel}
                    onChange={(e) =>
                      setEditableRecords((prev) =>
                        prev.map((item) =>
                          item.id === row.id ? { ...item, categoryLabel: e.target.value } : item,
                        ),
                      )
                    }
                    size="small"
                    fullWidth
                    disabled={!row.canEdit || savingEdits}
                  />
                  <TextField
                    label="Amount (₹)"
                    value={row.amount}
                    onChange={(e) =>
                      setEditableRecords((prev) =>
                        prev.map((item) =>
                          item.id === row.id ? { ...item, amount: e.target.value } : item,
                        ),
                      )
                    }
                    type="number"
                    size="small"
                    sx={{ minWidth: 160 }}
                    disabled={!row.canEdit || savingEdits}
                    slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                  />
                  <TextField
                    label="Date"
                    value={row.date}
                    onChange={(e) =>
                      setEditableRecords((prev) =>
                        prev.map((item) =>
                          item.id === row.id ? { ...item, date: e.target.value } : item,
                        ),
                      )
                    }
                    type="date"
                    size="small"
                    sx={{ minWidth: 180 }}
                    disabled={!row.canEdit || savingEdits}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  {row.canEdit ? (
                    <IconButton
                      aria-label="Delete expense"
                      color="error"
                      size="small"
                      disabled={savingEdits || Boolean(deletingExpenseId)}
                      onClick={() => handleDeleteExpense(row.expenseId)}
                      sx={{ mt: { xs: 0, sm: 0.5 } }}
                    >
                      {deletingExpenseId === row.expenseId ? (
                        <CircularProgress color="inherit" size={20} />
                      ) : (
                        <DeleteOutlineIcon />
                      )}
                    </IconButton>
                  ) : null}
                </Stack>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              if (!savingEdits) {
                setEditingRow(null);
                setEditableRecords([]);
              }
            }}
            disabled={savingEdits}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEdits}
            disabled={savingEdits || editableRecords.length === 0}
          >
            {savingEdits ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
