const GSTIN_FIELDS = ["gstNo", "gstin", "GSTIN", "outletGstNo", "outletGst", "uin", "UIN"];

export type OutletGstinRecord = {
  id?: string;
  name?: string;
  gstNo?: string;
};

const asTrimmedGstin = (value: unknown): string =>
  typeof value === "string" && value.trim() ? value.trim().toUpperCase() : "";

export function getReportOutletId(record: Record<string, unknown>): string {
  const nested = record.outlet;
  const nestedId =
    nested && typeof nested === "object"
      ? (nested as Record<string, unknown>).id ??
        (nested as Record<string, unknown>).outletId ??
        (nested as Record<string, unknown>).OutletID
      : undefined;
  const id =
    record.outletId ??
    record.OutletId ??
    record.OutletID ??
    record.outlet_id ??
    nestedId;
  return id != null && String(id).trim() !== "" ? String(id).trim() : "";
}

export function getReportOutletName(record: Record<string, unknown>): string {
  const nested = record.outlet;
  if (typeof nested === "string" && nested.trim()) {
    return nested.trim();
  }
  if (nested && typeof nested === "object") {
    const o = nested as Record<string, unknown>;
    const nestedName = o.name ?? o.outletName ?? o.OutletName;
    if (nestedName) return String(nestedName).trim();
  }
  const name = record.outletName ?? record.OutletName;
  return name ? String(name).trim() : "";
}

export function parseOutletRecord(data: unknown): OutletGstinRecord | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const record =
    obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)
      ? (obj.data as Record<string, unknown>)
      : obj;
  let gstNo = "";
  for (const field of GSTIN_FIELDS) {
    gstNo = asTrimmedGstin(record[field]);
    if (gstNo) break;
  }
  if (!record.id && !record.name && !gstNo) return null;
  return {
    id: record.id != null ? String(record.id) : undefined,
    name: record.name != null ? String(record.name) : undefined,
    gstNo: gstNo || undefined,
  };
}

export function findMatchingOutlet(
  record: Record<string, unknown>,
  outlets?: OutletGstinRecord[],
): OutletGstinRecord | undefined {
  if (!Array.isArray(outlets) || outlets.length === 0) return undefined;

  const outletId = getReportOutletId(record);
  const outletName = getReportOutletName(record);
  const normalizedName = outletName.toLowerCase();

  return outlets.find((outlet) => {
    const candidateId = outlet.id != null ? String(outlet.id).trim() : "";
    const candidateName = outlet.name != null ? String(outlet.name).trim().toLowerCase() : "";

    if (outletId && candidateId && candidateId.toLowerCase() === outletId.toLowerCase()) {
      return true;
    }
    if (normalizedName && candidateId && candidateId.toLowerCase() === normalizedName) {
      return true;
    }
    if (normalizedName && candidateName && candidateName === normalizedName) {
      return true;
    }
    return false;
  });
}

/** Resolve billed/shipped GSTIN from the order/return payload or the matching outlet. */
export function resolveCustomerGstin(
  record: Record<string, unknown>,
  outlets?: OutletGstinRecord[],
): string {
  for (const field of GSTIN_FIELDS) {
    const fromRecord = asTrimmedGstin(record[field]);
    if (fromRecord) return fromRecord;
  }

  const nestedOutlet = record.outlet;
  if (nestedOutlet && typeof nestedOutlet === "object") {
    const nested = nestedOutlet as Record<string, unknown>;
    for (const field of GSTIN_FIELDS) {
      const fromNested = asTrimmedGstin(nested[field]);
      if (fromNested) return fromNested;
    }
  }

  return asTrimmedGstin(findMatchingOutlet(record, outlets)?.gstNo);
}

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
