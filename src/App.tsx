import type { FC } from "react";
import { Authenticated, Refine, useLink } from "@refinedev/core";import {
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
import { FeatureGuard } from "./access/FeatureGuard";
import { POS_FEATURE, useTenantFeatures } from "./access/tenantFeatures";
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
import { brandIconSrc, brandLabel, useTenantBrand } from "./brand/useTenantBrand";

const AppTitle: FC<{ collapsed: boolean }> = ({ collapsed }) => {
  const Link = useLink();
  const brand = useTenantBrand();
  const label = brandLabel(brand);

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
          src={brandIconSrc()}
          alt={label || "Tenant"}
          sx={{
            width: collapsed ? 36 : 40,
            height: collapsed ? 36 : 40,
            objectFit: "contain",
            flexShrink: 0,
            display: "block",
          }}
        />
        {!collapsed && label ? (
          <Typography
            variant="h6"
            fontWeight={700}
            color="text.primary"
            noWrap
            sx={{ fontSize: "1rem", lineHeight: 1.2 }}
          >
            {label}
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

const RESOURCES = [
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
];

function App() {
  const brand = useTenantBrand();
  const brandName = brandLabel(brand) || "Outlet portal";
  const tenantFeatures = useTenantFeatures();
  const resources = RESOURCES.filter((resource) => {
    const feature = POS_FEATURE[resource.name];
    return !tenantFeatures || !feature || tenantFeatures.includes(feature);
  });

  return (    <BrowserRouter>
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
                resources={resources}
                options={{
                  syncWithLocation: true,
                  warnWhenUnsavedChanges: true,
                  disableTelemetry: true,
                  title: {
                    text: brandName,
                    icon: (
                      <Box
                        component="img"
                        src={brandIconSrc()}
                        alt=""
                        sx={{
                          width: 28,
                          height: 28,
                          objectFit: "contain",
                          display: "block",
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
                            <FeatureGuard features={tenantFeatures}>
                              <Outlet />
                            </FeatureGuard>
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
                <DocumentTitleHandler
                  handler={({ autoGeneratedTitle }) => {
                    const pageTitle = autoGeneratedTitle
                      .replace(/\s*\|\s*refine$/i, "")
                      .replace(/refine/gi, "")
                      .replace(
                        new RegExp(
                          `\\s*\\|\\s*${brandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                        ),
                        "",
                      )
                      .trim();
                    return pageTitle ? `${pageTitle} | ${brandName}` : brandName;
                  }}
                />
              </Refine>
            </CartProvider>
          </OutletProvider>
        </RefineSnackbarProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
