import type { FC } from "react";
import { Authenticated, Refine } from "@refinedev/core";
import {
  useNotificationProvider,
  RefineSnackbarProvider,
  ThemedLayout,
  ThemedSider,
  ThemedTitle,
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
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import Box from "@mui/material/Box";

import { dataProvider } from "./providers/dataProvider";
import { authProvider } from "./providers/authProvider";
import { OutletProvider } from "./context/outlet-context";
import { CartProvider } from "./context/cart-context";
import { ProductList } from "./pages/products/list";
import { SalesPage } from "./pages/sales/index";
import { ExpensePage } from "./pages/expenses/index";
import { LoginPage } from "./pages/login/index";
import { ReportsPage } from "./pages/reports/index";
import { ProductsManagementPage } from "./pages/products-management/index";

const BRAND_ICON_SRC = "/nannu-milk-icon.png";

const AppTitle: FC<{ collapsed: boolean }> = ({ collapsed }) => (
  <ThemedTitle
    collapsed={collapsed}
    text="Nannu Milk"
    icon={
      <Box
        component="img"
        src={BRAND_ICON_SRC}
        alt=""
        sx={{
          width: collapsed ? 26 : 30,
          height: collapsed ? 26 : 30,
          objectFit: "contain",
          display: "block",
          borderRadius: 1,
        }}
      />
    }
  />
);

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider theme={RefineThemes.Blue}>
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
                  <Route
                    element={
                      <Authenticated key="main" redirectOnFail="/login">
                        <ThemedLayout
                          Title={({ collapsed }) => (
                            <AppTitle collapsed={collapsed} />
                          )}
                          Sider={(siderProps) => (
                            <ThemedSider
                              {...siderProps}
                              render={({ items, logout }) => (
                                <>
                                  {items}
                                  {logout}
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
                    <Route path="/sales" element={<SalesPage />} />
                    <Route path="/cart" element={<Navigate to="/products" replace />} />
                    <Route path="/expenses" element={<ExpensePage />} />
                    <Route path="/reports" element={<ReportsPage />} />
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
