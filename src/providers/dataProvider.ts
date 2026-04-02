import type { BaseRecord, DataProvider, GetListParams } from "@refinedev/core";
import simpleRestDataProvider from "@refinedev/simple-rest";
import { API_BASE_URL, AUTH_STORAGE_KEY } from "../config";
import type { Product } from "../types/product";
import type { SaleRecord } from "../types/sale";
import type { ExpenseRecord } from "../types/expense";
import { getApiHeaders } from "./authProvider";

const base = simpleRestDataProvider(API_BASE_URL);

function normalizeListResponse<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  const nested = o.data ?? o.items ?? o.results;
  if (Array.isArray(nested)) return nested as T[];
  return [];
}

function getOutletId(): string {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { outletId?: string };
    return parsed?.outletId ?? "";
  } catch {
    return "";
  }
}

function extractOutletProducts(json: unknown): Record<string, unknown>[] {
  if (!json || typeof json !== "object") return [];
  const root = json as Record<string, unknown>;
  const inner = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : root;
  const products = inner.products;
  if (Array.isArray(products)) return products;
  if (products && typeof products === "object" && !Array.isArray(products)) {
    return Object.values(products) as Record<string, unknown>[];
  }
  if (Array.isArray(root.data)) return root.data;
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  return [];
}

export const dataProvider: DataProvider = {
  ...base,
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ) => {
    const { resource } = params;
    if (resource === "products") {
      const outletId = getOutletId();
      const response = await fetch(
        `${API_BASE_URL}/outlet-products?outletId=${encodeURIComponent(outletId)}`,
        { headers: getApiHeaders() },
      );
      if (!response.ok) {
        throw new Error("Could not load products");
      }
      const json = await response.json();
      const raw = extractOutletProducts(json);
      const data: Product[] = raw.map((r) => ({
        id: String(r.productId ?? r._id ?? r.id ?? ""),
        productId: String(r.productId ?? r._id ?? r.id ?? ""),
        name: String(r.name ?? ""),
        price: Number(r.price) || 0,
        unit: r.unit != null ? String(r.unit) : undefined,
        active: r.active !== false,
        category: r.category != null ? String(r.category) : undefined,
        availableQuantity: r.quantity != null ? Number(r.quantity) || 0 : r.availableQuantity != null ? Number(r.availableQuantity) || 0 : undefined,
      }));
      return {
        data: data as unknown as TData[],
        total: data.length,
      };
    }
    if (resource === "all-products") {
      const response = await fetch(`${API_BASE_URL}/products`, {
        headers: getApiHeaders(),
      });
      if (!response.ok) {
        throw new Error("Could not load products");
      }
      const data = (await response.json()) as Product[];
      return {
        data: data as unknown as TData[],
        total: data.length,
      };
    }
    if (resource === "sales") {
      const response = await fetch(`${API_BASE_URL}/Sales`, {
        headers: getApiHeaders(),
      });
      if (!response.ok) {
        throw new Error("Could not load sales");
      }
      const json = await response.json();
      const data = normalizeListResponse<SaleRecord>(json);
      return {
        data: data as unknown as TData[],
        total: data.length,
      };
    }
    if (resource === "expenses") {
      const response = await fetch(`${API_BASE_URL}/expenses`, {
        headers: getApiHeaders(),
      });
      if (!response.ok) {
        throw new Error("Could not load expenses");
      }
      const json = await response.json();
      const data = normalizeListResponse<ExpenseRecord>(json);
      return {
        data: data as unknown as TData[],
        total: data.length,
      };
    }
    return base.getList(params);
  },
};
