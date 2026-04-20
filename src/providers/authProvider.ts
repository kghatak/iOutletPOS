import type { AuthProvider } from "@refinedev/core";
import {
  API_TENANT_HEADER,
  AUTH_LOGIN_URL,
  AUTH_STORAGE_KEY,
} from "../config";

export const SESSION_END_EVENT = "ioutlet:session-ended";

/** Fired after login writes the session so `outletId` can sync (same tab). */
export const AUTH_UPDATED_EVENT = "ioutlet:auth-updated";

type Session = {
  phoneNumber: string;
  /** Shown in the header — prefer outlet name from login `data.outlet.name`. */
  name: string;
  email?: string;
  id?: string;
  outletId?: string;
  tenantId?: string;
  userId?: string;
  /** Bearer / JWT when the API returns one; optional if auth is cookie-only. */
  token?: string;
};

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.phoneNumber) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * JSON + optional `Authorization: Bearer` + tenant header from the session in `localStorage`
 * (written at login; includes `tenantId` from `data.tenantId`).
 */
/** Returns the `name` stored in the session — shown in the app header, used as cashier on invoices. */
export function getSessionCashierName(): string | undefined {
  try {
    const session = readSession();
    const n = session?.name?.trim();
    return n || undefined;
  } catch {
    return undefined;
  }
}

export function getApiHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const session = readSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }
  const tenant = session?.tenantId?.trim();
  if (tenant) {
    headers[API_TENANT_HEADER] = tenant;
  }
  if (extra) {
    Object.assign(headers, extra);
  }
  return headers;
}

function pickToken(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const o = body as Record<string, unknown>;
  const keys = ["accessToken", "access_token", "token", "jwt", "idToken"];
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v) return v;
  }
  for (const nested of [o.data, o.result]) {
    if (!nested || typeof nested !== "object") continue;
    const n = nested as Record<string, unknown>;
    for (const k of keys) {
      const v = n[k];
      if (typeof v === "string" && v) return v;
    }
  }
  return undefined;
}

function normalizePhone(value: unknown, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value).replace(/\D/g, "").slice(0, 10) || fallback;
  }
  if (typeof value === "string" && value) {
    return value.replace(/\D/g, "").slice(0, 10) || fallback;
  }
  return fallback;
}

function outletNameFrom(data: Record<string, unknown>): string | undefined {
  const outlet = data.outlet;
  if (outlet && typeof outlet === "object") {
    const n = (outlet as Record<string, unknown>).name;
    if (typeof n === "string" && n.trim()) return n.trim();
  }
  return undefined;
}

/**
 * Maps login JSON to session fields. Supports
 * `{ success, data: { token, phoneNumber, outlet: { name }, userId, outletId, tenantId } }`
 * and a few older/generic shapes.
 */
function pickSessionFields(
  body: unknown,
  fallbackPhone: string,
): Omit<Session, "token"> {
  if (!body || typeof body !== "object") {
    return {
      phoneNumber: fallbackPhone,
      name: fallbackPhone,
    };
  }

  const root = body as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;

  const phoneNumber = normalizePhone(
    data.phoneNumber ?? data.phone,
    fallbackPhone,
  );

  const fromOutlet = outletNameFrom(data);
  const name =
    fromOutlet ||
    (typeof data.name === "string" && data.name.trim()) ||
    (typeof data.fullName === "string" && data.fullName.trim()) ||
    phoneNumber;

  const userId = typeof data.userId === "string" ? data.userId : undefined;
  const outletId = typeof data.outletId === "string" ? data.outletId : undefined;
  const tenantId = typeof data.tenantId === "string" ? data.tenantId : undefined;
  const id = userId ?? outletId;
  const email = typeof data.email === "string" ? data.email : undefined;

  return {
    phoneNumber,
    name,
    email,
    id,
    outletId,
    tenantId,
    userId,
  };
}

async function readErrorMessage(res: Response): Promise<string> {
  let message = `Login failed (${res.status})`;
  try {
    const text = await res.text();
    if (!text) return message;
    try {
      const j = JSON.parse(text) as Record<string, unknown>;
      const fromApi =
        (typeof j.message === "string" && j.message) ||
        (typeof j.error === "string" && j.error) ||
        (typeof j.title === "string" && j.title) ||
        (Array.isArray(j.errors) &&
          typeof j.errors[0] === "string" &&
          j.errors[0]);
      if (fromApi) message = fromApi;
    } catch {
      if (text.length < 200) message = text;
    }
  } catch {
    /* ignore */
  }
  return message;
}

// Dev credentials for bypassing auth when backend is unavailable
const DEV_PHONE = "1234567890";
const DEV_PASSWORD = "dev123";

export const authProvider: AuthProvider = {
  login: async ({
    phoneNumber,
    password,
  }: {
    phoneNumber: string;
    password: string;
  }) => {
    const phone = (phoneNumber ?? "").replace(/\D/g, "").slice(0, 10);
    const pwd = password ?? "";

    if (phone.length !== 10 || !pwd) {
      return {
        success: false,
        error: new Error("Enter a valid 10-digit phone number and password."),
      };
    }

    // Dev login bypass - allows testing without backend auth
    if (phone === DEV_PHONE && pwd === DEV_PASSWORD) {
      const devSession: Session = {
        phoneNumber: DEV_PHONE,
        name: "Dev User",
        email: "dev@ioutletpos.local",
        id: "dev-user-001",
        outletId: "dev-outlet-001",
        tenantId: "dev-tenant-001",
        userId: "dev-user-001",
        token: "dev-token-not-for-production",
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(devSession));
      window.dispatchEvent(new Event(AUTH_UPDATED_EVENT));
      return {
        success: true,
        redirectTo: "/products",
      };
    }

    try {
      const res = await fetch(AUTH_LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phoneNumber: phone,
          password: pwd,
        }),
      });

      if (!res.ok) {
        const message = await readErrorMessage(res);
        return {
          success: false,
          error: new Error(message),
        };
      }

      let body: unknown = null;
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        try {
          body = await res.json();
        } catch {
          body = null;
        }
      }

      const token = pickToken(body);
      const fields = pickSessionFields(body, phone);
      const session: Session = {
        ...fields,
        phoneNumber: fields.phoneNumber || phone,
        token,
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      window.dispatchEvent(new Event(AUTH_UPDATED_EVENT));

      return {
        success: true,
        redirectTo: "/products",
      };
    } catch {
      return {
        success: false,
        error: new Error(
          "Could not reach the login server. Is it running on " +
            new URL(AUTH_LOGIN_URL).origin +
            "?",
        ),
      };
    }
  },

  logout: async () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new Event(SESSION_END_EVENT));
    return {
      success: true,
      redirectTo: "/login",
    };
  },

  check: async () => {
    const session = readSession();
    if (!session) {
      return {
        authenticated: false,
        redirectTo: "/login",
      };
    }
    return { authenticated: true };
  },

  onError: async () => ({
    logout: true,
    redirectTo: "/login",
  }),

  getIdentity: async () => {
    const session = readSession();
    if (!session) return null;
    return {
      id: session.id ?? session.userId ?? session.outletId ?? session.phoneNumber,
      name: session.name,
      /** Omit phone here so the header shows outlet name, not the number again. */
      email: session.email,
    };
  },
};
