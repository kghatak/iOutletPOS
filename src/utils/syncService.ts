import { API_BASE_URL } from "../config";
import { getApiHeaders } from "../providers/authProvider";
import { getPendingOrders, removeFromQueue, updateQueueEntry } from "./offlineQueue";

const MAX_RETRIES = 3;

async function trySyncOne(
  localId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/sales`, {
      method: "POST",
      headers: getApiHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      removeFromQueue(localId);
      window.dispatchEvent(new Event("offlinequeue:synced"));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function syncPendingOrders(): Promise<void> {
  const pending = getPendingOrders().filter((o) => o.status === "pending_sync");
  if (pending.length === 0) return;

  for (const order of pending) {
    updateQueueEntry(order.localId, { status: "syncing" });
    const ok = await trySyncOne(order.localId, order.payload);
    if (!ok) {
      const retries = order.retries + 1;
      updateQueueEntry(order.localId, {
        status: retries >= MAX_RETRIES ? "sync_failed" : "pending_sync",
        retries,
      });
    }
  }
}

let started = false;

/** Call once at app startup. Idempotent. */
export function startSyncService(): void {
  if (started) return;
  started = true;

  window.addEventListener("online", () => {
    void syncPendingOrders();
  });

  setInterval(() => {
    if (navigator.onLine) void syncPendingOrders();
  }, 30_000);

  if (navigator.onLine) void syncPendingOrders();
}
