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
};
