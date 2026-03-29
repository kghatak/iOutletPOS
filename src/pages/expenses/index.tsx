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
} from "../../types/expense";

const columns: GridColDef<ExpenseGridRow>[] = [
  {
    field: "expenseId",
    headerName: "Expense ID",
    flex: 1,
    minWidth: 100,
  },
  {
    field: "category",
    headerName: "Category",
    flex: 1.5,
    minWidth: 120,
  },
  {
    field: "amount",
    headerName: "Amount",
    flex: 0.8,
    minWidth: 90,
    align: "right",
    headerAlign: "right",
    type: "number",
    renderCell: (params) => (
      <Typography variant="body2" sx={{ width: "100%", textAlign: "right" }}>
        {formatRupee(params.row.amount)}
      </Typography>
    ),
  },
  {
    field: "createdAt",
    headerName: "CreatedAt",
    flex: 1.2,
    minWidth: 130,
  },
];

export const ExpensePage = () => {
  const queryClient = useQueryClient();
  const notification = useNotification();
  const { outletId } = useOutlet();

  const listQuery = useList<ExpenseRecord>({
    resource: "expenses",
    pagination: { mode: "off" },
    queryOptions: { staleTime: 30 * 1000 },
  });

  const rows = useMemo(
    () => expenseRecordsToGridRows(listQuery.result?.data ?? []),
    [listQuery.result?.data],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [expenseType, setExpenseType] = useState<ExpenseCategoryValue>("electricity");
  const [otherLabel, setOtherLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setExpenseType("electricity");
    setOtherLabel("");
    setAmount("");
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

      {rows.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 3 }}>
          No expenses recorded yet.
        </Typography>
      ) : (
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
    </>
  );
};
