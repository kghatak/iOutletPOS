import { useEffect, useState } from "react";
import { API_BASE_URL, API_TENANT_HEADER, AUTH_STORAGE_KEY } from "../config";
import { AUTH_UPDATED_EVENT, SESSION_END_EVENT } from "../providers/authProvider";

export type TenantBrand = {
  business: string;
  name: string;
};

const APP_TITLE = "Outlet portal";
const CACHE_KEY = "tenant-brand";
const BRAND_ICON = "/signin-logo.png";

const EMPTY: TenantBrand = { business: "", name: "" };

type Cached = { tenantId: string; brand: TenantBrand };

let memory: Cached | null = null;
let inflight: Promise<void> | null = null;
let inflightTenant = "";
const listeners = new Set<() => void>();

export function brandLabel(brand: TenantBrand): string {
  return (brand.business || brand.name).trim();
}

export function brandIconSrc(): string {
  return BRAND_ICON;
}

function sessionTenantId(): string {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { tenantId?: unknown };
    return typeof parsed.tenantId === "string" ? parsed.tenantId.trim() : "";
  } catch {
    return "";
  }
}

function parseBrand(value: unknown): TenantBrand | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!("business" in row) && !("name" in row)) return null;
  return {
    business: typeof row.business === "string" ? row.business.trim() : "",
    name: typeof row.name === "string" ? row.name.trim() : "",
  };
}

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const brand = parseBrand(parsed);
    const tenantId = typeof parsed.tenantId === "string" ? parsed.tenantId.trim() : "";
    if (!brand || !tenantId) return null;
    return { tenantId, brand };
  } catch {
    return null;
  }
}

function visibleBrand(): TenantBrand {
  const session = sessionTenantId();
  if (!session) return EMPTY;
  const cached = readCache();
  if (memory?.tenantId === session) return memory.brand;
  if (cached?.tenantId === session) return cached.brand;
  return EMPTY;
}

function applyFavicon() {
  const href = brandIconSrc();
  document
    .querySelectorAll<HTMLLinkElement>("link[rel='icon'], link[rel='apple-touch-icon']")
    .forEach((node) => {
      node.href = href;
      node.type = "image/png";
    });
  document
    .querySelectorAll<HTMLMetaElement>("meta[property='og:image'], meta[name='twitter:image']")
    .forEach((node) => {
      node.content = href;
    });
}

function applyDocumentTitle(label: string) {
  const next = label || APP_TITLE;
  const current = document.title.trim();
  if (!current || !current.includes("|")) {
    document.title = next;
    return;
  }
  const parts = current.split(/\s*\|\s*/);
  parts[parts.length - 1] = next;
  document.title = parts.join(" | ");
}

function notify() {
  const brand = visibleBrand();
  applyFavicon();
  applyDocumentTitle(brandLabel(brand));
  listeners.forEach((listener) => listener());
}

async function refreshBrand() {
  const tenantId = sessionTenantId();
  if (!tenantId) {
    notify();
    return;
  }
  if (memory?.tenantId === tenantId) return;
  const cached = readCache();
  if (cached?.tenantId === tenantId) {
    memory = cached;
    notify();
    return;
  }
  if (inflight && inflightTenant === tenantId) return inflight;

  inflightTenant = tenantId;
  inflight = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tenant-brand`, {
        headers: { Accept: "application/json", [API_TENANT_HEADER]: tenantId },
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { data?: unknown };
      const brand = parseBrand(payload?.data);
      if (!brand) return;
      memory = { tenantId, brand };
      localStorage.setItem(CACHE_KEY, JSON.stringify({ tenantId, ...brand }));
      notify();
    } catch {
      /* keep the last brand */
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useTenantBrand(): TenantBrand {
  const [brand, setBrand] = useState(visibleBrand);

  useEffect(() => {
    const sync = () => setBrand(visibleBrand());
    listeners.add(sync);
    const onChange = () => {
      void refreshBrand();
    };
    window.addEventListener(AUTH_UPDATED_EVENT, onChange);
    window.addEventListener(SESSION_END_EVENT, onChange);
    onChange();
    return () => {
      listeners.delete(sync);
      window.removeEventListener(AUTH_UPDATED_EVENT, onChange);
      window.removeEventListener(SESSION_END_EVENT, onChange);
    };
  }, []);

  return brand;
}
