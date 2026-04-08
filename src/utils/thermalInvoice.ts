import { createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import type { InvoiceData, ThermalPaperWidth } from "../types/thermalInvoice";
import { ThermalInvoicePdfDocument } from "../pdf/ThermalInvoicePdfDocument";

export type { InvoiceData, InvoiceItem, ThermalPaperWidth } from "../types/thermalInvoice";

/**
 * @react-pdf/renderer thermal invoice (3″ or 4″). Opens PDF in a new tab.
 */
export async function printThermalInvoice(
  data: InvoiceData,
  options?: { paperWidth?: ThermalPaperWidth },
): Promise<void> {
  const payload: InvoiceData =
    options?.paperWidth != null ? { ...data, paperWidth: options.paperWidth } : data;
  const blob = await pdf(
    createElement(ThermalInvoicePdfDocument, { data: payload }) as Parameters<typeof pdf>[0],
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    window.open(url, "_blank");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
