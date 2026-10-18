import { useEffect, useState } from "react";
import { API_BASE_URL, API_TENANT_HEADER } from "../config";
import { getSessionFeatures, getSessionTenantId, saveSessionFeatures } from "../providers/authProvider";

export const POS_FEATURE: Record<string, string> = {
  products: "ioutlet.pos",
  "products-management": "ioutlet.products",
  sales: "ioutlet.sales",
  expenses: "ioutlet.expenses",
  reports: "ioutlet.reports",
  wastage: "ioutlet.wastage",
};

const PATH_FEATURES: [string, string][] = [
  ["/products-management", "ioutlet.products"],
  ["/products", "ioutlet.pos"],
  ["/sales", "ioutlet.sales"],
  ["/expenses", "ioutlet.expenses"],
  ["/reports", "ioutlet.reports"],
  ["/wastage", "ioutlet.wastage"],
];

const LANDING: [string, string][] = [
  ["ioutlet.pos", "/products"],
  ["ioutlet.products", "/products-management"],
  ["ioutlet.sales", "/sales"],
  ["ioutlet.expenses", "/expenses"],
  ["ioutlet.reports", "/reports"],
  ["ioutlet.wastage", "/wastage"],
];

export function featureForPosPath(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const match = PATH_FEATURES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match ? match[1] : null;
}

export function firstPosPath(features: string[]): string | null {
  const found = LANDING.find(([key]) => features.includes(key));
  return found ? found[1] : null;
}

export function useTenantFeatures(): string[] | null {
  const [features, setFeatures] = useState<string[] | null>(getSessionFeatures);

  useEffect(() => {
    let active = true;

    async function load() {
      const tenantId = getSessionTenantId();
      if (!tenantId) return;
      try {
        const response = await fetch(`${API_BASE_URL}/tenant-features`, {
          headers: { Accept: "application/json", [API_TENANT_HEADER]: tenantId },
        });
        const payload = await response.json();
        const list = payload?.data?.features;
        if (!active || !Array.isArray(list)) return;
        const next = list.filter((key: unknown) => typeof key === "string");
        setFeatures(next);
        saveSessionFeatures(next);
      } catch {
        /* keep the last list */
      }
    }

    load();
    window.addEventListener("focus", load);
    const timer = window.setInterval(load, 30000);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
      window.clearInterval(timer);
    };
  }, []);

  return features;
}
