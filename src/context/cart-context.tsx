import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AUTH_STORAGE_KEY } from "../config";
import type { Product } from "../types/product";
import type { CartLine } from "../types/cart";
import {
  lineSubtotal,
  normalizeCartQuantity,
  productToLine,
} from "../types/cart";
import {
  AUTH_UPDATED_EVENT,
  SESSION_END_EVENT,
} from "../providers/authProvider";

const CART_STORAGE_KEY = "ioutlet:cart";

type SessionSnapshot = {
  phoneNumber: string;
  outletId?: string;
  tenantId?: string;
};

type PersistedCartV1 = {
  v: 1;
  phoneNumber: string;
  outletId?: string;
  tenantId?: string;
  lines: CartLine[];
};

function readSessionSnapshot(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<SessionSnapshot>;
    if (typeof s.phoneNumber !== "string" || !s.phoneNumber) return null;
    return {
      phoneNumber: s.phoneNumber,
      outletId: typeof s.outletId === "string" ? s.outletId : undefined,
      tenantId: typeof s.tenantId === "string" ? s.tenantId : undefined,
    };
  } catch {
    return null;
  }
}

function normalizeLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CartLine[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const productId = o.productId;
    const name = o.name;
    const unitPrice = o.unitPrice;
    const quantity = o.quantity;
    if (typeof productId !== "string" || !productId) continue;
    if (typeof name !== "string") continue;
    if (typeof unitPrice !== "number" || !Number.isFinite(unitPrice)) continue;
    const q = normalizeCartQuantity(Number(quantity));
    if (q <= 0) continue;
    out.push({ productId, name, unitPrice, quantity: q });
  }
  return out;
}

function loadPersistedLines(): CartLine[] {
  const session = readSessionSnapshot();
  if (!session) return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as Partial<PersistedCartV1>;
    if (data.v !== 1 || typeof data.phoneNumber !== "string") return [];
    if (
      data.phoneNumber !== session.phoneNumber ||
      (data.outletId ?? "") !== (session.outletId ?? "") ||
      (data.tenantId ?? "") !== (session.tenantId ?? "")
    ) {
      return [];
    }
    return normalizeLines(data.lines);
  } catch {
    return [];
  }
}

function writePersistedCart(lines: CartLine[]) {
  const session = readSessionSnapshot();
  if (!session) return;
  try {
    if (lines.length === 0) {
      localStorage.removeItem(CART_STORAGE_KEY);
      return;
    }
    const payload: PersistedCartV1 = {
      v: 1,
      phoneNumber: session.phoneNumber,
      outletId: session.outletId,
      tenantId: session.tenantId,
      lines,
    };
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

function clearPersistedCartStorage() {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

type CartContextValue = {
  lines: CartLine[];
  addProduct: (product: Product) => void;
  /** Add this many units in one step (merged with any existing line). */
  addProductQuantity: (product: Product, quantity: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
  itemCount: number;
  total: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [lines, setLines] = useState<CartLine[]>(() => loadPersistedLines());

  const addProduct = useCallback((product: Product) => {
    const id = product.productId ?? product.id;
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === id);
      if (idx === -1) return [...prev, productToLine(product, 1)];
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
      return next;
    });
  }, []);

  const addProductQuantity = useCallback((product: Product, quantity: number) => {
    const q = normalizeCartQuantity(quantity);
    if (q <= 0) return;
    const id = product.productId ?? product.id;
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === id);
      if (idx === -1) return [...prev, productToLine(product, q)];
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: next[idx].quantity + q };
      return next;
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const q = normalizeCartQuantity(quantity);
    setLines((prev) => {
      if (q === 0) return prev.filter((l) => l.productId !== productId);
      return prev.map((l) =>
        l.productId === productId ? { ...l, quantity: q } : l,
      );
    });
  }, []);

  const removeLine = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  useEffect(() => {
    writePersistedCart(lines);
  }, [lines]);

  useEffect(() => {
    const onSessionEnd = () => {
      clearPersistedCartStorage();
      setLines([]);
    };
    window.addEventListener(SESSION_END_EVENT, onSessionEnd);
    return () => window.removeEventListener(SESSION_END_EVENT, onSessionEnd);
  }, []);

  useEffect(() => {
    const onAuthUpdated = () => setLines(loadPersistedLines());
    window.addEventListener(AUTH_UPDATED_EVENT, onAuthUpdated);
    return () => window.removeEventListener(AUTH_UPDATED_EVENT, onAuthUpdated);
  }, []);

  const { itemCount, total } = useMemo(() => {
    const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
    const total = lines.reduce((s, l) => s + lineSubtotal(l), 0);
    return { itemCount, total };
  }, [lines]);

  const value = useMemo(
    () => ({
      lines,
      addProduct,
      addProductQuantity,
      setQuantity,
      removeLine,
      clear,
      itemCount,
      total,
    }),
    [lines, addProduct, addProductQuantity, setQuantity, removeLine, clear, itemCount, total],
  );

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
};

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}
