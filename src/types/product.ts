export type Product = {
  id: string;
  productId: string;
  name: string;
  price: number;
  unit?: string;
  active?: boolean;
  category?: string;
  /** When set and positive, caps quantity on the product card. */
  availableQuantity?: number;
  /** Added on POS (not from Products Management catalog). */
  isManual?: boolean;
};

/** Prefix for manually added POS products — recognizable in cart and sales payloads. */
export const MANUAL_PRODUCT_ID_PREFIX = "manual:";
