export type WastageStatus = "pending" | "accepted" | "rejected";

export type WastageRecord = {
  id: string;
  _id?: string;
  outletId: string;
  name: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  price: number;
  reason: string;
  status: WastageStatus;
  date: string;
  createdAt?: string;
  updatedAt?: string;
};

export const WASTAGE_REASONS = [
  { value: "expired", label: "Expired" },
  { value: "damaged", label: "Damaged" },
  { value: "spillage", label: "Spillage" },
  { value: "contaminated", label: "Contaminated" },
  { value: "theft", label: "Theft" },
  { value: "other", label: "Other" },
] as const;
