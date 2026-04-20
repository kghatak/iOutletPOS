import { createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import type { InvoiceData } from "../types/thermalInvoice";
import { ThermalInvoicePdfDocument } from "../pdf/ThermalInvoicePdfDocument";

export type { InvoiceData, InvoiceItem } from "../types/thermalInvoice";

/**
 * @react-pdf/renderer 3″ thermal invoice. Opens PDF in a new tab.
 */
export async function printThermalInvoice(data: InvoiceData): Promise<void> {
  const payload: InvoiceData = { ...data, paperWidth: "3inch" };
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
