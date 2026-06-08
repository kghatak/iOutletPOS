import type {
  ExpenseCategoryValue,
  ExpensePaidFromValue,
  ExpenseRecord,
} from "../../types/expense";
import type { GridPaginationModel } from "@mui/x-data-grid";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAID_FROM_OPTIONS,
  getExpenseApiId,
  getExpenseRowId,
} from "../../types/expense";

export type DateWiseExpenseRow = {
  id: string;
  dateKey: string;
  dateLabel: string;
  totalAmount: number;
  records: ExpenseRecord[];
};

export type ExpenseViewGridRow = {
  id: string;
  /** Index into `DateWiseExpenseRow.records` / `toEditableExpenseRows` result */
  rowIndex: number;
  series: number;
  expenseDate: string;
  expenseType: string;
  amount: number;
  paidFromLabel: string;
  employee: string;
  remarks: string;
  /** Placeholder for DataGrid action column */
  actions?: string;
};

export type EditableExpenseRow = {
  id: string;
  expenseId: string;
  expenseType: ExpenseCategoryValue;
  otherLabel: string;
  amount: string;
  paidFrom: ExpensePaidFromValue;
  date: string;
  employee: string;
  remarks: string;
  originalExpenseType: ExpenseCategoryValue;
  originalOtherLabel: string;
  originalAmount: string;
  originalPaidFrom: ExpensePaidFromValue;
  originalDate: string;
  originalEmployee: string;
  originalRemarks: string;
  canEdit: boolean;
};

export function getTodayDateInputValue(): string {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

export function getRecordAmount(record: ExpenseRecord): number {
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

export function getExpenseRecordDateKey(record: ExpenseRecord): string {
  return toDateKey(getRecordDateSource(record));
}

/** Keeps only records whose expense date matches `YYYY-MM-DD` (client fallback when API ignores `date`). */
export function filterExpenseRecordsByDateKey(
  records: ExpenseRecord[] | undefined,
  dateKey: string,
): ExpenseRecord[] {
  if (!dateKey) return records ?? [];
  return (records ?? []).filter((r) => getExpenseRecordDateKey(r) === dateKey);
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

export function toDateLabel(dateKey: string): string {
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

function paidFromValueFromRecord(record: ExpenseRecord): ExpensePaidFromValue {
  const raw = record.paidFrom;
  if (typeof raw !== "string" || !raw.trim()) return "cash";
  const trimmed = raw.trim();
  const byLabel = EXPENSE_PAID_FROM_OPTIONS.find((o) => o.label === trimmed);
  if (byLabel) return byLabel.value;
  const byValue = EXPENSE_PAID_FROM_OPTIONS.find((o) => o.value === trimmed);
  if (byValue) return byValue.value;
  if (/upi/i.test(trimmed)) return "upi";
  if (/cash/i.test(trimmed)) return "cash";
  return "cash";
}

function getRecordPaidFromLabel(record: ExpenseRecord): string {
  const raw = record.paidFrom;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return (
    EXPENSE_PAID_FROM_OPTIONS.find((o) => o.value === paidFromValueFromRecord(record))?.label ?? "—"
  );
}

function getRecordExpenseType(record: ExpenseRecord): {
  expenseType: ExpenseCategoryValue;
  otherLabel: string;
} {
  const rawType = typeof record.type === "string" ? record.type.trim() : "";
  const byValue = EXPENSE_CATEGORIES.find((c) => c.value === rawType);
  if (byValue) {
    if (byValue.value === "other") {
      const name = getRecordCategoryLabel(record);
      return { expenseType: "other", otherLabel: name === "—" ? "" : name };
    }
    return { expenseType: byValue.value, otherLabel: "" };
  }
  const label = getRecordCategoryLabel(record);
  if (label === "—") {
    return { expenseType: "other", otherLabel: "" };
  }
  const byLabel = EXPENSE_CATEGORIES.find((c) => c.label === label);
  if (byLabel) {
    return { expenseType: byLabel.value, otherLabel: "" };
  }
  return { expenseType: "other", otherLabel: label };
}

function expenseTypeDisplayLabel(type: ExpenseCategoryValue): string {
  return EXPENSE_CATEGORIES.find((t) => t.value === type)?.label ?? type;
}

export function buildDateWiseRows(records: ExpenseRecord[] | undefined): DateWiseExpenseRow[] {
  const grouped = new Map<string, DateWiseExpenseRow>();
  for (const record of records ?? []) {
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
}

export function buildExpenseViewGridRows(viewingRow: DateWiseExpenseRow | null): ExpenseViewGridRow[] {
  if (!viewingRow) return [];
  return viewingRow.records.map((record, index) => {
    const { expenseType: et, otherLabel: ol } = getRecordExpenseType(record);
    const typeLabel = expenseTypeDisplayLabel(et);
    const expenseTypeCell =
      et === "other"
        ? ol.trim()
          ? `${typeLabel} (${ol.trim()})`
          : typeLabel
        : typeLabel;
    return {
      id: getExpenseRowId(record, index),
      rowIndex: index,
      series: index + 1,
      expenseDate: getRecordDateLabel(record),
      expenseType: expenseTypeCell,
      amount: getRecordAmount(record),
      paidFromLabel: getRecordPaidFromLabel(record),
      employee:
        typeof record.employee === "string" && record.employee.trim()
          ? record.employee.trim()
          : "—",
      remarks:
        typeof record.remarks === "string" && record.remarks.trim()
          ? record.remarks.trim()
          : "—",
      actions: "",
    };
  });
}

export function toEditableExpenseRows(row: DateWiseExpenseRow): EditableExpenseRow[] {
  return row.records.map((record, index) => {
    const expenseId = getExpenseApiId(record);
    const baseAmount = getRecordAmount(record);
    const baseDate = toDateKey(getRecordDateSource(record)) || getTodayDateInputValue();
    const { expenseType: et, otherLabel: ol } = getRecordExpenseType(record);
    const pf = paidFromValueFromRecord(record);
    const emp = typeof record.employee === "string" ? record.employee : "";
    const rem = typeof record.remarks === "string" ? record.remarks : "";
    return {
      id: `${getExpenseRowId(record, index)}-${index}`,
      expenseId,
      expenseType: et,
      otherLabel: ol,
      amount: String(baseAmount),
      paidFrom: pf,
      date: baseDate,
      employee: emp,
      remarks: rem,
      originalExpenseType: et,
      originalOtherLabel: ol,
      originalAmount: String(baseAmount),
      originalPaidFrom: pf,
      originalDate: baseDate,
      originalEmployee: emp,
      originalRemarks: rem,
      canEdit: Boolean(expenseId),
    };
  });
}

export const EXPENSE_LIST_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type ExpenseViewLocationState = {
  expensesListSearch?: string;
};

export function parseExpenseListPagination(
  searchParams: URLSearchParams,
): GridPaginationModel {
  const page = Math.max(0, Number.parseInt(searchParams.get("page") ?? "0", 10) || 0);
  const pageSizeRaw =
    Number.parseInt(searchParams.get("pageSize") ?? "10", 10) || 10;
  const pageSize = (EXPENSE_LIST_PAGE_SIZE_OPTIONS as readonly number[]).includes(
    pageSizeRaw,
  )
    ? pageSizeRaw
    : 10;
  return { page, pageSize };
}

export function buildExpensesListPath(search = ""): string {
  return search ? `/expenses?${search}` : "/expenses";
}
