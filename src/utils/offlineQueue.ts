import type { InvoiceData } from "../types/thermalInvoice";

const QUEUE_KEY = "ioutlet:offline_queue";

export type QueuedOrderStatus = "pending_sync" | "syncing" | "sync_failed";

export interface QueuedOrder {
  localId: string;
  status: QueuedOrderStatus;
  createdAt: string;
  retries: number;
  /** Raw POST body sent to /sales */
  payload: Record<string, unknown>;
  /** Invoice data for offline printing */
  invoiceData: InvoiceData;
}

function readQueue(): QueuedOrder[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedOrder[];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedOrder[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function notify(): void {
  window.dispatchEvent(new Event("offlinequeue:change"));
}

export function enqueueOrder(
  payload: Record<string, unknown>,
  invoiceData: InvoiceData,
): QueuedOrder {
  const queue = readQueue();
  const order: QueuedOrder = {
    localId: `LOCAL-${Date.now()}`,
    status: "pending_sync",
    createdAt: new Date().toISOString(),
    retries: 0,
    payload,
    invoiceData,
  };
  queue.push(order);
  writeQueue(queue);
  notify();
  return order;
}

export function getAllQueuedOrders(): QueuedOrder[] {
  return readQueue();
}

export function getPendingOrders(): QueuedOrder[] {
  return readQueue().filter(
    (o) => o.status === "pending_sync" || o.status === "sync_failed",
  );
}

export function removeFromQueue(localId: string): void {
  writeQueue(readQueue().filter((o) => o.localId !== localId));
  notify();
}

export function updateQueueEntry(
  localId: string,
  update: Partial<QueuedOrder>,
): void {
  writeQueue(
    readQueue().map((o) => (o.localId === localId ? { ...o, ...update } : o)),
  );
  notify();
}
