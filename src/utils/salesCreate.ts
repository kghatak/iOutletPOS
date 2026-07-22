import { API_BASE_URL } from "../config";

/**
 * Must match list endpoint casing (`GET /Sales` in dataProvider). Many hosts are
 * case-sensitive; `POST /sales` can 404 while `GET /Sales` works.
 */
export function getSalesCreatePostUrl(): string {
  return `${API_BASE_URL}/Sales`;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Whether create-sale HTTP response should count as success (queues otherwise). */
export function isSalesCreateResponseSuccess(res: Response, body: unknown): boolean {
  if (!res.ok) return false;
  const o = asRecord(body);
  if (!o) return true;
  if (o.success === false || o.Success === false) return false;
  if (o.isSuccess === false || o.IsSuccess === false) return false;
  if (o.ok === false || o.Ok === false) return false;
  return true;
}

export function extractCreatedSaleId(body: unknown): string {
  const o = asRecord(body);
  if (!o) return "";
  const pick = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v).trim();
    return s || "";
  };
  const data = asRecord(o.data);
  if (data) {
    const id =
      pick(data.saleId) ||
      pick(data.SaleId) ||
      pick(data.id) ||
      pick(data.Id);
    if (id) return id;
  }
  return pick(o.saleId) || pick(o.SaleId) || pick(o.id) || pick(o.Id);
}

/** True when the server queued a WhatsApp bill link for the customer phone. */
export function extractWhatsappBillQueued(body: unknown): boolean {
  const o = asRecord(body);
  if (!o) return false;
  if (o.whatsappBillQueued === true || o.WhatsappBillQueued === true) return true;
  return false;
}

/** Short human hint when create was rejected or non-OK. */
export function extractSalesCreateFailureHint(res: Response, body: unknown): string {
  if (!res.ok) return `HTTP ${res.status}`;
  const o = asRecord(body);
  if (!o) return "Response not accepted";
  const msg =
    (typeof o.message === "string" && o.message.trim()) ||
    (typeof o.Message === "string" && o.Message.trim()) ||
    (typeof o.error === "string" && o.error.trim()) ||
    "";
  return msg || "Sale was not confirmed by the server";
}
