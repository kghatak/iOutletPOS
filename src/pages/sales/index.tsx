import { useEffect, useMemo } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { useList, keys } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import type { SaleRecord, SalesGridRow } from "../../types/sale";
import { saleRecordsToGridRows } from "../../types/sale";
import type { SaleOrderDiscount } from "../../types/sale";
import { SalesHistoryGrid } from "../../components/SalesHistoryGrid";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { updateQueueEntry } from "../../utils/offlineQueue";
import type { QueuedOrder } from "../../utils/offlineQueue";
import { syncPendingOrders } from "../../utils/syncService";
import type { InvoiceItem } from "../../types/thermalInvoice";

function queuedOrderToGridRow(order: QueuedOrder): SalesGridRow {
  const inv = order.invoiceData;
  const items: InvoiceItem[] = inv.items ?? [];
  const productNames = items.map((i) => i.name).filter(Boolean);
  const products =
    productNames.length === 0
      ? "—"
      : productNames.length <= 2
        ? productNames.join(", ")
        : `${productNames.slice(0, 2).join(", ")} +${productNames.length - 2} more`;

  return {
    id: order.localId,
    salesId: order.localId,
    products,
    itemsCount: items.reduce((s, i) => s + (Number(i.quantity) || 0), 0),
    amount: inv.total,
    createdAt: new Date(order.createdAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    createdAtIso: order.createdAt,
    rawItems: items.map((i) => ({
      name: i.name,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    customer:
      inv.customerName
        ? { name: inv.customerName, phone: inv.customerPhone, address: inv.customerAddress }
        : undefined,
    subtotal: inv.subtotal,
    discount: inv.discount as SaleOrderDiscount | undefined,
    paymentMode: inv.paymentMode,
    pendingSync: order.status === "pending_sync" || order.status === "syncing",
    syncFailed: order.status === "sync_failed",
    localId: order.localId,
  };
}

export const SalesPage = () => {
  const queryClient = useQueryClient();
  const { pending, failed, orders } = useOfflineQueue();

  const salesListQuery = useList<SaleRecord>({
    resource: "sales",
    pagination: { mode: "off" },
    queryOptions: { staleTime: 30 * 1000 },
  });

  // Refetch from server whenever an offline order successfully syncs
  useEffect(() => {
    const handler = () => {
      void queryClient.invalidateQueries({
        queryKey: keys().data().resource("sales").action("list").get(),
      });
    };
    window.addEventListener("offlinequeue:synced", handler);
    return () => window.removeEventListener("offlinequeue:synced", handler);
  }, [queryClient]);

  const serverRows = useMemo(
    () => saleRecordsToGridRows(salesListQuery.result?.data ?? []),
    [salesListQuery.result?.data],
  );

  // Queued orders shown at the top of the grid
  const queueRows = useMemo(
    () => orders.map(queuedOrderToGridRow),
    [orders],
  );

  const allRows = useMemo(() => [...queueRows, ...serverRows], [queueRows, serverRows]);

  const handleRetrySync = (localId: string) => {
    updateQueueEntry(localId, { status: "pending_sync" });
    void syncPendingOrders();
  };

  return (
    <>
      {pending.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {pending.length} order{pending.length > 1 ? "s" : ""} saved offline — will sync automatically when connected.
        </Alert>
      )}
      {failed.length > 0 && (
        <Alert
          severity="error"
          sx={{ mb: 1 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                for (const o of failed) {
                  updateQueueEntry(o.localId, { status: "pending_sync" });
                }
                void syncPendingOrders();
              }}
            >
              Retry All
            </Button>
          }
        >
          {failed.length} order{failed.length > 1 ? "s" : ""} failed to sync after multiple attempts.
        </Alert>
      )}

      <SalesHistoryGrid
        rows={allRows}
        loading={salesListQuery.query.isPending}
        error={salesListQuery.query.isError}
        onRetrySync={handleRetrySync}
      />
    </>
  );
};
