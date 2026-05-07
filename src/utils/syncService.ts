import { API_BASE_URL } from "../config";
import { getApiHeaders } from "../providers/authProvider";
import { getPendingOrders, removeFromQueue, updateQueueEntry } from "./offlineQueue";

const MAX_RETRIES = 3;
type SyncWindow = Window & {
  __ioutletSyncStarted?: boolean;
  __ioutletSyncInProgress?: boolean;
};

function getSyncWindow(): SyncWindow {
  return window as SyncWindow;
}

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
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function syncPendingOrders(): Promise<void> {
  const w = getSyncWindow();
  if (w.__ioutletSyncInProgress) return;
  const pending = getPendingOrders().filter((o) => o.status === "pending_sync");
  if (pending.length === 0) return;

  w.__ioutletSyncInProgress = true;
  let syncedCount = 0;
  try {
    for (const order of pending) {
      updateQueueEntry(order.localId, { status: "syncing" });
      const ok = await trySyncOne(order.localId, order.payload);
      if (ok) {
        syncedCount += 1;
      } else {
        const retries = order.retries + 1;
        updateQueueEntry(order.localId, {
          status: retries >= MAX_RETRIES ? "sync_failed" : "pending_sync",
          retries,
        });
      }
    }
  } finally {
    w.__ioutletSyncInProgress = false;
  }

  if (syncedCount > 0) {
    window.dispatchEvent(
      new CustomEvent("offlinequeue:batch-synced", {
        detail: { syncedCount },
      }),
    );
  }
}

let started = false;

/** Call once at app startup. Idempotent. */
export function startSyncService(): void {
  const w = getSyncWindow();
  if (started || w.__ioutletSyncStarted) return;
  started = true;
  w.__ioutletSyncStarted = true;

  window.addEventListener("online", () => {
    void syncPendingOrders();
  });

  setInterval(() => {
    if (navigator.onLine) void syncPendingOrders();
  }, 30_000);

  if (navigator.onLine) void syncPendingOrders();
}
