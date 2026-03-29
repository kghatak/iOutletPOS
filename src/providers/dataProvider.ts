import type { BaseRecord, DataProvider, GetListParams } from "@refinedev/core";
import simpleRestDataProvider from "@refinedev/simple-rest";
import { API_BASE_URL } from "../config";
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

export const dataProvider: DataProvider = {
  ...base,
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ) => {
    const { resource } = params;
    if (resource === "products") {
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
