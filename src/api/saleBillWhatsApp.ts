import { API_BASE_URL } from "../config";
import { getApiHeaders } from "../providers/authProvider";

/** Resend the public bill link on WhatsApp for an existing sale. */
export async function resendSaleBillWhatsApp(documentId: string): Promise<Response> {
  const url = `${API_BASE_URL}/sales/${encodeURIComponent(documentId)}/send-bill`;
  return fetch(url, {
    method: "POST",
    headers: getApiHeaders(),
  });
}
