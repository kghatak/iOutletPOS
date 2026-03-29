import { useMemo } from "react";
import { useList } from "@refinedev/core";
import type { SaleRecord } from "../../types/sale";
import { saleRecordsToGridRows } from "../../types/sale";
import { SalesHistoryGrid } from "../../components/SalesHistoryGrid";

export const SalesPage = () => {
  const salesListQuery = useList<SaleRecord>({
    resource: "sales",
    pagination: { mode: "off" },
    queryOptions: {
      staleTime: 30 * 1000,
    },
  });

  const salesRows = salesListQuery.result?.data ?? [];
  const salesGridRows = useMemo(
    () => saleRecordsToGridRows(salesRows),
    [salesRows],
  );

  return (
    <SalesHistoryGrid
      rows={salesGridRows}
      loading={salesListQuery.query.isPending}
      error={salesListQuery.query.isError}
    />
  );
};
