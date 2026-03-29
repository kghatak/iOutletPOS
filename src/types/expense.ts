import type { BaseRecord } from "@refinedev/core";

export const EXPENSE_CATEGORIES = [
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "rent", label: "Rent" },
  { value: "salaries", label: "Salaries" },
  { value: "supplies", label: "Supplies" },
  { value: "maintenance", label: "Maintenance" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
] as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number]["value"];

export type ExpenseRecord = BaseRecord & {
  id?: string;
  expenseId?: string;
  outletId?: string;
  type?: string;
  category?: string;
  categoryLabel?: string;
  name?: string;
  amount?: number;
  Amount?: number;
  createdAt?: string;
  CreatedAt?: string;
  date?: string;
};

export type ExpenseGridRow = {
  id: string;
  expenseId: string;
  category: string;
  amount: number;
  createdAt: string;
};

export function getExpenseRowId(r: ExpenseRecord, i: number): string {
  const id = r.expenseId ?? r.id;
  return typeof id === "string" && id ? id : `exp-${i}`;
}

function getExpenseCategory(r: ExpenseRecord): string {
  if (typeof r.categoryLabel === "string" && r.categoryLabel.trim()) {
    return r.categoryLabel.trim();
  }
  if (typeof r.category === "string" && r.category.trim()) {
    return r.category.trim();
  }
  if (typeof r.name === "string" && r.name.trim()) {
    return r.name.trim();
  }
  const found = EXPENSE_CATEGORIES.find((c) => c.value === r.type);
  if (found) return found.label;
  if (typeof r.type === "string" && r.type.trim()) return r.type.trim();
  return "—";
}

function getExpenseAmount(r: ExpenseRecord): number {
  const a = r.amount ?? r.Amount;
  if (typeof a === "number" && Number.isFinite(a)) return a;
  return 0;
}

function getExpenseDate(r: ExpenseRecord): string {
  const raw = r.createdAt ?? r.CreatedAt ?? r.date;
  if (typeof raw !== "string" || !raw.trim()) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRupee(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function expenseRecordsToGridRows(
  records: ExpenseRecord[],
): ExpenseGridRow[] {
  return records.map((r, i) => ({
    id: getExpenseRowId(r, i),
    expenseId: getExpenseRowId(r, i),
    category: getExpenseCategory(r),
    amount: getExpenseAmount(r),
    createdAt: getExpenseDate(r),
  }));
}
