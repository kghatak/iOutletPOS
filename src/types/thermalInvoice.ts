/** Thermal roll width for PDF page size (72pt per inch). */
export type ThermalPaperWidth = "3inch";

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
  paperWidth?: ThermalPaperWidth;
  /** 3″ retail layout: e.g. Pick Up / Delivery */
  orderType?: string;
  /** Shown on 3″ retail invoice (e.g. logged-in staff). */
  cashierName?: string;
  /** 24h time e.g. `15:24` for 3″ retail invoice. */
  billTime?: string;
}
