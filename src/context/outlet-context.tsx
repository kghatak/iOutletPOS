import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AUTH_STORAGE_KEY } from "../config";
import {
  AUTH_UPDATED_EVENT,
  SESSION_END_EVENT,
} from "../providers/authProvider";

type OutletContextValue = {
  outletId: string;
};

const OutletContext = createContext<OutletContextValue | null>(null);

function readOutletIdFromAuth(): string {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { outletId?: string };
    if (typeof parsed?.outletId === "string" && parsed.outletId) {
      return parsed.outletId;
    }
  } catch {
    /* ignore */
  }
  return "";
}

export const OutletProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [outletId, setOutletId] = useState(readOutletIdFromAuth);

  useEffect(() => {
    const sync = () => setOutletId(readOutletIdFromAuth());
    window.addEventListener(AUTH_UPDATED_EVENT, sync);
    window.addEventListener(SESSION_END_EVENT, sync);
    return () => {
      window.removeEventListener(AUTH_UPDATED_EVENT, sync);
      window.removeEventListener(SESSION_END_EVENT, sync);
    };
  }, []);

  const value = useMemo(() => ({ outletId }), [outletId]);

  return (
    <OutletContext.Provider value={value}>{children}</OutletContext.Provider>
  );
};

export function useOutlet(): OutletContextValue {
  const ctx = useContext(OutletContext);
  if (!ctx) {
    throw new Error("useOutlet must be used within OutletProvider");
  }
  return ctx;
}
