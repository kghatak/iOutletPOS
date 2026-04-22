import { useCallback, useEffect, useState } from "react";
import { getAllQueuedOrders, type QueuedOrder } from "../utils/offlineQueue";

export function useOfflineQueue() {
  const [orders, setOrders] = useState<QueuedOrder[]>(() =>
    getAllQueuedOrders(),
  );

  const refresh = useCallback(() => {
    setOrders(getAllQueuedOrders());
  }, []);

  useEffect(() => {
    window.addEventListener("offlinequeue:change", refresh);
    return () => window.removeEventListener("offlinequeue:change", refresh);
  }, [refresh]);

  const pending = orders.filter(
    (o) => o.status === "pending_sync" || o.status === "syncing",
  );
  const failed = orders.filter((o) => o.status === "sync_failed");

  return { orders, pending, failed, refresh };
}
