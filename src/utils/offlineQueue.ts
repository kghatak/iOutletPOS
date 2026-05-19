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

/** 100000–999999 — short reference for receipts (no LOCAL- prefix). */
function randomSixDigitId(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

function allocateUniqueQueuedLocalId(): string {
  const existing = readQueue().map((o) => o.localId);
  const used = new Set(existing);
  for (let i = 0; i < 50; i += 1) {
    const id = randomSixDigitId();
    if (!used.has(id)) return id;
  }
  const t = Date.now();
  const fallback = String(100_000 + (t % 900_000));
  if (!used.has(fallback)) return fallback;
  return String(t % 10_000_000).padStart(6, "0").slice(-6);
}

export function enqueueOrder(
  payload: Record<string, unknown>,
  invoiceData: InvoiceData,
): QueuedOrder {
  const queue = readQueue();
  const localId = allocateUniqueQueuedLocalId();
  const order: QueuedOrder = {
    localId,
    status: "pending_sync",
    createdAt: new Date().toISOString(),
    retries: 0,
    payload,
    invoiceData: { ...invoiceData, invoiceNo: localId },
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
