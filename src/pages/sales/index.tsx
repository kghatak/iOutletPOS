import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { GridPaginationModel } from "@mui/x-data-grid";
import { useList } from "@refinedev/core";
import type { SaleRecord } from "../../types/sale";
import { isSalePaymentDue, saleRecordsToGridRows } from "../../types/sale";
import { SalesHistoryGrid } from "../../components/SalesHistoryGrid";

export const SalesPage = () => {
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

      <SalesHistoryGrid
        rows={displayServerRows}
        loading={salesListQuery.query.isPending}
        error={salesListQuery.query.isError}
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
