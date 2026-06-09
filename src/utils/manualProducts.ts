import type { Product } from "../types/product";
import { MANUAL_PRODUCT_ID_PREFIX } from "../types/product";

export function isManualProductId(productId: string): boolean {
  return productId.startsWith(MANUAL_PRODUCT_ID_PREFIX);
}

export function createManualProduct(
  input: { name: string; price: number; category: string; unit?: string; quantity?: number },
): Product {
  const id = `${MANUAL_PRODUCT_ID_PREFIX}${crypto.randomUUID()}`;
  const name = input.name.trim();
  const price = Math.max(0, Number(input.price) || 0);
  const category = input.category.trim();
  const unit = input.unit?.trim() || undefined;
  const qty = Number(input.quantity);
  const availableQuantity = Number.isFinite(qty) && qty >= 0 ? qty : 0;
  return {
    id,
    productId: id,
    name,
    price,
    category,
    unit,
    availableQuantity,
    isManual: true,
    active: true,
  };
}