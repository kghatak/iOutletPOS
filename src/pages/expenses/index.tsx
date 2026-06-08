import { useCallback, useMemo, useState } from "react";
import type { GridPaginationModel } from "@mui/x-data-grid";
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
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { keys, useList, useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { useOutlet } from "../../context/outlet-context";
import { API_BASE_URL } from "../../config";
import { getApiHeaders } from "../../providers/authProvider";
import type {
  ExpenseCategoryValue,
  ExpenseDateSummary,
  ExpensePaidFromValue,
} from "../../types/expense";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAID_FROM_OPTIONS,
  formatRupee,
} from "../../types/expense";
import {
  EXPENSE_LIST_PAGE_SIZE_OPTIONS,
  getTodayDateInputValue,
  parseExpenseListPagination,
  toDateLabel,
  type DateWiseExpenseRow,
} from "./expense-helpers";

function mapSummariesToDateWiseRows(
  items: ExpenseDateSummary[] | undefined,
): DateWiseExpenseRow[] {
  return (items ?? []).map((s) => {
    const dateKey = typeof s.date === "string" ? s.date.slice(0, 10) : "";
    return {
      id: dateKey || "undated",
      dateKey,
      dateLabel: toDateLabel(dateKey),
      totalAmount: Number(s.totalAmount) || 0,
      records: [],
    };
  });
}

export const ExpensePage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const notification = useNotification();
  const { outletId } = useOutlet();

  const paginationModel = useMemo(
    () => parseExpenseListPagination(searchParams),
    [searchParams],
  );

  const handlePaginationModelChange = useCallback(
    (model: GridPaginationModel) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (model.page <= 0) next.delete("page");
          else next.set("page", String(model.page));
          if (model.pageSize === 10) next.delete("pageSize");
          else next.set("pageSize", String(model.pageSize));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const expensesListSearch = searchParams.toString();

  const listQuery = useList<ExpenseDateSummary>({
    resource: "expenses",
    pagination: {
      mode: "server",
      currentPage: paginationModel.page + 1,
      pageSize: paginationModel.pageSize,
    },
    meta: { summaryByDate: true },
    errorNotification: false,
    queryOptions: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
  });

  const totalFromApi = Number(listQuery.result?.total ?? 0) || 0;

  const dateWiseRows = useMemo(
    () => mapSummariesToDateWiseRows(listQuery.result?.data),
    [listQuery.result?.data],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [expenseType, setExpenseType] = useState<ExpenseCategoryValue>("electricity");
  const [otherLabel, setOtherLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [paidFrom, setPaidFrom] = useState<ExpensePaidFromValue>("cash");
  const [remarks, setRemarks] = useState("");
  const [employee, setEmployee] = useState("");
  const [expenseDate, setExpenseDate] = useState(getTodayDateInputValue());
  const [submitting, setSubmitting] = useState(false);

  const amountErrorMessage = useMemo(() => {
    const t = amount.trim();
    if (!t) return "Amount is required.";
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return "Enter a positive number.";
    return "";
  }, [amount]);

  const addExpenseFormValid = useMemo(() => {
    const parsed = Number(amount);
    const amountOk = Number.isFinite(parsed) && parsed > 0;
    const otherOk = expenseType !== "other" || otherLabel.trim().length > 0;
    return amountOk && otherOk && Boolean(expenseDate?.trim());
  }, [amount, expenseType, otherLabel, expenseDate]);

  const resetForm = () => {
    setExpenseType("electricity");
    setOtherLabel("");
    setAmount("");
    setAmountTouched(false);
    setPaidFrom("cash");
    setRemarks("");
    setEmployee("");
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

    const paidFromLabel =
      EXPENSE_PAID_FROM_OPTIONS.find((o) => o.value === paidFrom)?.label ?? paidFrom;

    const payload = {
      outletId,
      type: expenseType,
      categoryLabel,
      amount: parsed,
      date: expenseDate,
      paidFrom: paidFromLabel,
      ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      ...(employee.trim() ? { employee: employee.trim() } : {}),
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
        minWidth: 72,
        maxWidth: 88,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => (
          <Tooltip title="View">
            <IconButton
              size="small"
              aria-label="View expenses for this date"
              color="primary"
              onClick={() =>
                navigate(`/expenses/${encodeURIComponent(params.row.id)}/view`, {
                  state: { expensesListSearch },
                })
              }
            >
              <VisibilityOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [navigate, expensesListSearch],
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
          paginationMode="server"
          rowCount={totalFromApi}
          paginationModel={paginationModel}
          onPaginationModelChange={handlePaginationModelChange}
          pageSizeOptions={[...EXPENSE_LIST_PAGE_SIZE_OPTIONS]}
          loading={listQuery.query.isFetching}
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
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountTouched(true);
              }}
              onBlur={() => setAmountTouched(true)}
              type="number"
              fullWidth
              size="small"
              required
              error={amountTouched && amountErrorMessage !== ""}
              helperText={amountTouched && amountErrorMessage ? amountErrorMessage : undefined}
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
            />

            <TextField
              select
              label="Paid from"
              value={paidFrom}
              onChange={(e) =>
                setPaidFrom(e.target.value as ExpensePaidFromValue)
              }
              fullWidth
              size="small"
              required
            >
              {EXPENSE_PAID_FROM_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

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

            <TextField
              label="Employee Name(optional)"
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
              fullWidth
              size="small"
              placeholder="Enter Employee Name"
            />

            <TextField
              label="Remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              fullWidth
              size="small"
              multiline
              minRows={2}
              placeholder="Optional"
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
            disabled={submitting || !addExpenseFormValid}
          >
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
