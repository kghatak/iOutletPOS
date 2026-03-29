/**
 * Single backend origin for the app (local or production).
 * Set in `.env`:
 *
 *   Local:  VITE_API_URL=http://localhost:5020
 *   Prod:   VITE_API_URL=https://your-api.example.com
 *
 * Used for: `/products`, `POST /outlet-portal/auth/login`, `/sales`, `/expenses`, etc.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:5020";

export const AUTH_STORAGE_KEY = "ioutlet:session";

/**
 * HTTP header sent on authenticated requests with `tenantId` from login (stored in session).
 * Change if your API expects a different name (e.g. `Tenant-Id`).
 */
export const API_TENANT_HEADER =
  import.meta.env.VITE_API_TENANT_HEADER ?? "X-Tenant-Id";

/** `POST {API_BASE_URL}/outlet-portal/auth/login` */
export const AUTH_LOGIN_URL = `${API_BASE_URL}/outlet-portal/auth/login`;
