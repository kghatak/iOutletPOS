import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { GridPaginationModel } from "@mui/x-data-grid";
import { useList, keys, useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import type { SaleRecord, SalesGridRow } from "../../types/sale";
import { isSalePaymentDue, saleRecordsToGridRows } from "../../types/sale";
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
    payments: inv.payments,
    pendingSync: order.status === "pending_sync" || order.status === "syncing",
    syncFailed: order.status === "sync_failed",
    localId: order.localId,
  };
}

export const SalesPage = () => {
  const queryClient = useQueryClient();
  const notification = useNotification();
  const { pending, failed, orders } = useOfflineQueue();
  const [salesView, setSalesView] = useState<"all" | "due">("all");
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  useEffect(() => {
    setPaginationModel((m) => ({ ...m, page: 0 }));
  }, [salesView]);

  const salesListQuery = useList<SaleRecord>({
    resource: "sales",
    pagination: {
      mode: "server",
      currentPage: paginationModel.page + 1,
      pageSize: paginationModel.pageSize,
    },
    ...(salesView === "due"
      ? { meta: { salesDueOnly: true } as Record<string, unknown> }
      : {}),
    errorNotification: false,
    queryOptions: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });

  const totalFromApi = Number(salesListQuery.result?.total ?? 0) || 0;

  const serverRows = useMemo(
    () =>
      saleRecordsToGridRows(
        (salesListQuery.result?.data ?? []) as SaleRecord[],
      ),
    [salesListQuery.result?.data],
  );

  const displayServerRows = useMemo(() => {
    if (salesView === "all") return serverRows;
    return serverRows.filter((r) => isSalePaymentDue(r.paymentMode));
  }, [salesView, serverRows]);

  const queueRows = useMemo(
    () => orders.map(queuedOrderToGridRow),
    [orders],
  );

  // Refetch from server whenever an offline order successfully syncs
  useEffect(() => {
    const handler = () => {
      void queryClient.invalidateQueries({
        queryKey: keys().data().resource("sales").action("list").get(),
      });
    };
    window.addEventListener("offlinequeue:batch-synced", handler);
    return () => window.removeEventListener("offlinequeue:batch-synced", handler);
  }, [queryClient]);

  const handleTryReconnect = () => {
    if (!navigator.onLine) {
      notification.open?.({
        type: "error",
        message: "Still offline",
        description: "Please reconnect to internet, then try again.",
      });
      return;
    }
    void syncPendingOrders();
    notification.open?.({
      type: "success",
      message: "Sync started",
      description: "Trying to sync offline orders now.",
    });
  };

  const handleRetrySync = (localId: string) => {
    updateQueueEntry(localId, { status: "pending_sync" });
    void syncPendingOrders();
  };

  return (
    <>
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
        <ToggleButtonGroup
          value={salesView}
          exclusive
          size="small"
          onChange={(_, v) => {
            if (v) setSalesView(v);
          }}
        >
          <ToggleButton value="all">All sales</ToggleButton>
          <ToggleButton value="due">Outstanding due</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {pending.length > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 1 }}
          action={(
            <Button color="inherit" size="small" onClick={handleTryReconnect}>
              Try Reconnect
            </Button>
          )}
        >
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

      {queueRows.length > 0 && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            These rows are saved on this device only until they sync to the server.
          </Typography>
          <SalesHistoryGrid
            rows={queueRows}
            loading={false}
            error={false}
            onRetrySync={handleRetrySync}
            dueCollectionMode={false}
            listTitle="Local orders"
            compactTable
            hideExport
          />
        </>
      )}

      <SalesHistoryGrid
        rows={displayServerRows}
        loading={salesListQuery.query.isPending}
        error={salesListQuery.query.isError}
        onRetrySync={handleRetrySync}
        dueCollectionMode={salesView === "due"}
        listTitle={salesView === "due" ? "Outstanding due" : "Sales"}
        toolbarExtra={(
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Button
              variant="outlined"
              size="medium"
              component={Link}
              to="/sales/employee-report"
              startIcon={<GroupsOutlinedIcon />}
            >
              Employee Report
            </Button>
            <Button
              variant="outlined"
              size="medium"
              component={Link}
              to="/sales/item-summary"
              startIcon={<Inventory2OutlinedIcon />}
            >
              Item summary
            </Button>
          </Stack>
        )}
        serverPagination={{
          rowCount: totalFromApi,
          paginationModel,
          onPaginationModelChange: setPaginationModel,
        }}
      />
    </>
  );
};
