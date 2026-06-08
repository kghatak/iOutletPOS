import type { FC } from "react";
import { Authenticated, Refine, useLink } from "@refinedev/core";
import {
  useNotificationProvider,
  RefineSnackbarProvider,
  ThemedLayout,
  ThemedSider,
  RefineThemes,
  ErrorComponent,
} from "@refinedev/mui";
import routerProvider, {
  UnsavedChangesNotifier,
  DocumentTitleHandler,
} from "@refinedev/react-router";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSaleOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import InventoryOutlinedIcon from "@mui/icons-material/InventoryOutlined";
import DeleteSweepOutlinedIcon from "@mui/icons-material/DeleteSweepOutlined";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import MuiLink from "@mui/material/Link";

import { dataProvider } from "./providers/dataProvider";
import { startSyncService } from "./utils/syncService";

startSyncService();
import { authProvider } from "./providers/authProvider";
import { OutletProvider } from "./context/outlet-context";
import { CartProvider } from "./context/cart-context";
import { ProductList } from "./pages/products/list";
import { SalesPage } from "./pages/sales/index";
import { SalesItemSummaryPage } from "./pages/sales/item-summary";
import { SalesEmployeeReportPage } from "./pages/sales/employee-report";
import { ExpensePage } from "./pages/expenses/index";
import { ExpenseDateViewPage } from "./pages/expenses/expense-view";
import { LoginPage } from "./pages/login/index";
import { SessionExpiredPage } from "./pages/session-expired/index";
import { ReportsPage } from "./pages/reports/index";
import { ProductsManagementPage } from "./pages/products-management/index";
import { WastagePage } from "./pages/wastage/index";
import { AppLayoutHeader } from "./components/AppLayoutHeader";
import { SiderLogoutButton } from "./components/SiderLogoutButton";

const BRAND_ICON_SRC = "/nannu-milk-icon.png";

const AppTitle: FC<{ collapsed: boolean }> = ({ collapsed }) => {
  const Link = useLink();

  return (
    <Link to="/" style={{ textDecoration: "none" }}>
      <MuiLink
        underline="none"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <Box
          component="img"
          src={BRAND_ICON_SRC}
          alt="Nannu Milk"
          sx={{
            width: collapsed ? 36 : 40,
            height: collapsed ? 36 : 40,
            objectFit: "contain",
            borderRadius: 1,
            flexShrink: 0,
            display: "block",
          }}
        />
        {!collapsed ? (
          <Typography
            variant="h6"
            fontWeight={700}
            color="text.primary"
            noWrap
            sx={{ fontSize: "1rem", lineHeight: 1.2 }}
          >
            Nannu Milk
          </Typography>
        ) : null}
      </MuiLink>
    </Link>
  );
};

const appTheme = createTheme(RefineThemes.Blue, {
  palette: {
    primary: {
      main: "#d32f2f",
    },
    secondary: {
      main: "#ef5350",
    },
  },
});

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <GlobalStyles styles={{ html: { WebkitFontSmoothing: "auto" } }} />
        <RefineSnackbarProvider>
          <OutletProvider>
            <CartProvider>
              <Refine
                routerProvider={routerProvider}
                dataProvider={dataProvider}
                authProvider={authProvider}
                notificationProvider={useNotificationProvider}
                resources={[
                  {
                    name: "products",
                    list: "/products",
                    meta: {
                      label: "POS",
                      icon: <StorefrontOutlinedIcon />,
                    },
                  },
                  {
                    name: "products-management",
                    list: "/products-management",
                    meta: {
                      label: "Products Management",
                      icon: <InventoryOutlinedIcon />,
                    },
                  },
                  {
                    name: "sales",
                    list: "/sales",
                    meta: {
                      label: "Sales",
                      icon: <PointOfSaleOutlinedIcon />,
                    },
                  },
                  {
                    name: "expenses",
                    list: "/expenses",
                    meta: {
                      label: "Expenses",
                      icon: <ReceiptLongOutlinedIcon />,
                    },
                  },
                  {
                    name: "reports",
                    list: "/reports",
                    meta: {
                      label: "Reports",
                      icon: <AssessmentOutlinedIcon />,
                    },
                  },
                  {
                    name: "wastage",
                    list: "/wastage",
                    meta: {
                      label: "Wastage Details",
                      icon: <DeleteSweepOutlinedIcon />,
                    },
                  },
                ]}
                options={{
                  syncWithLocation: true,
                  warnWhenUnsavedChanges: true,
                  disableTelemetry: true,
                  title: {
                    text: "Nannu Milk",
                    icon: (
                      <Box
                        component="img"
                        src={BRAND_ICON_SRC}
                        alt=""
                        sx={{
                          width: 28,
                          height: 28,
                          objectFit: "contain",
                          display: "block",
                          borderRadius: 1,
                        }}
                      />
                    ),
                  },
                }}
              >
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/session-expired" element={<SessionExpiredPage />} />
                  <Route
                    element={
                      <Authenticated key="main" redirectOnFail="/login">
                        <ThemedLayout
                          initialSiderCollapsed
                          Header={AppLayoutHeader}
                          Title={({ collapsed }) => (
                            <AppTitle collapsed={collapsed} />
                          )}
                          Sider={(siderProps) => (
                            <ThemedSider
                              {...siderProps}
                              render={({ items, collapsed }) => (
                                <>
                                  {items}
                                  <SiderLogoutButton collapsed={collapsed} />
                                </>
                              )}
                            />
                          )}
                        >
                          <Box sx={{ p: { xs: 1, sm: 2 } }}>
                            <Outlet />
                          </Box>
                        </ThemedLayout>
                      </Authenticated>
                    }
                  >
                    <Route
                      index
                      element={<Navigate to="/products" replace />}
                    />
                    <Route path="/products" element={<ProductList />} />
                    <Route path="/products-management" element={<ProductsManagementPage />} />
                    <Route path="/sales/item-summary" element={<SalesItemSummaryPage />} />
                    <Route path="/sales/employee-report" element={<SalesEmployeeReportPage />} />
                    <Route path="/sales" element={<SalesPage />} />
                    <Route path="/cart" element={<Navigate to="/products" replace />} />
                    <Route path="/expenses/:dateKey/view" element={<ExpenseDateViewPage />} />
                    <Route path="/expenses" element={<ExpensePage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/wastage" element={<WastagePage />} />
                    <Route path="*" element={<ErrorComponent />} />
                  </Route>
                </Routes>
                <UnsavedChangesNotifier />
                <DocumentTitleHandler />
              </Refine>
            </CartProvider>
          </OutletProvider>
        </RefineSnackbarProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
