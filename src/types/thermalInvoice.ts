/** Thermal roll width for PDF page size (72pt per inch). */
export type ThermalPaperWidth = "3inch" | "4inch";

export interface InvoiceItem {
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  discountPercentage?: number;
  gst?: number;
  icon?: string;
  hsn_sac_code?: string;
}

export interface InvoiceData {
  invoiceNo: string;
  date: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerGst?: string;
  items: InvoiceItem[];
  subtotal?: number;
  /** Rupees off, or API `{ amount, type?, value? }`. */
  discount?: number | { amount?: number; type?: string; value?: number };
  total: number;
  paymentMode?: string;
  /** Default 4″ when omitted. */
  paperWidth?: ThermalPaperWidth;
}
