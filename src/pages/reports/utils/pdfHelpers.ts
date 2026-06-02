export function getHSNCode(itemName: string): string {
  const name = itemName.toLowerCase();
  if (name.includes("namkeen") || name.includes("bhujiya")) return "19041090";
  if (name.includes("rasmalai") || name.includes("sweet")) return "17049090";
  if (name.includes("milk")) return "0401";
  if (name.includes("ghee")) return "04059020";
  return "19041090";
}

export function formatCurrencyWithCommas(amount: number | string): string {
  const n = Number(amount || 0);
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateForLedger(dateValue: unknown): string {
  try {
    if (dateValue && typeof dateValue === "object") {
      const o = dateValue as Record<string, unknown>;
      if (typeof o._seconds === "number") {
        return new Date(o._seconds * 1000).toLocaleDateString("en-GB").replace(/\//g, "-");
      }
    }
    if (dateValue) {
      const d = new Date(dateValue as string);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-GB").replace(/\//g, "-");
      }
    }
    return "N/A";
  } catch {
    return "N/A";
  }
}

export function safeString(value: unknown): string {
  if (value == null) return "N/A";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o._seconds === "number") {
      return new Date(o._seconds * 1000).toLocaleDateString("en-GB");
    }
    return JSON.stringify(value);
  }
  return String(value);
}
