import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SearchIcon from "@mui/icons-material/Search";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { GridPaginationModel } from "@mui/x-data-grid";
import { useList } from "@refinedev/core";
import type { SaleRecord } from "../../types/sale";
import { isSalePaymentDue, saleRecordsToGridRows } from "../../types/sale";
import { SalesHistoryGrid } from "../../components/SalesHistoryGrid";

export const SalesPage = () => {
  const [salesView, setSalesView] = useState<"all" | "due">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPaginationModel((m) => ({ ...m, page: 0 }));
  }, [salesView, search]);

  const salesListMeta = useMemo(() => {
    const meta: Record<string, unknown> = {};
    if (salesView === "due") meta.salesDueOnly = true;
    if (search) meta.salesSearch = search;
    return Object.keys(meta).length > 0 ? meta : undefined;
  }, [salesView, search]);

  const salesListQuery = useList<SaleRecord>({
    resource: "sales",
    pagination: {
      mode: "server",
      currentPage: paginationModel.page + 1,
      pageSize: paginationModel.pageSize,
    },
    ...(salesListMeta ? { meta: salesListMeta } : {}),
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
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        flexWrap="wrap"
        gap={1.5}
        sx={{ mb: 2 }}
      >
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
        <TextField
          size="small"
          placeholder="Search by sale ID, name, or phone"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ minWidth: { xs: "100%", sm: 280 }, maxWidth: { sm: 360 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
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
