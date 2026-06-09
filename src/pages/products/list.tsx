import { useEffect, useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import { useNavigate } from "react-router";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import Fab from "@mui/material/Fab";
import Badge from "@mui/material/Badge";
import Chip from "@mui/material/Chip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import InventoryOutlinedIcon from "@mui/icons-material/InventoryOutlined";
import type { Product } from "../../types/product";
import {
  formatCartQuantityForInput,
  parseQtyInputString,
} from "../../types/cart";
import { useCart } from "../../context/cart-context";
import { InlineCart } from "../../components/InlineCart";

const CART_WIDTH = 370;

function ProductCard({ product }: { product: Product }) {
  const { lines, addProductQuantity, setQuantity } = useCart();
  const productId = product.productId ?? product.id;
  const line = lines.find((l) => l.productId === productId);
  const inCart = Boolean(line);
  const hasStock = product.availableQuantity != null;
  const outOfStock = hasStock && product.availableQuantity! <= 0;
  const stockCap = hasStock && product.availableQuantity! > 0 ? product.availableQuantity : undefined;
  const [qtyStr, setQtyStr] = useState("1");

  useEffect(() => {
    if (!inCart) setQtyStr("1");
  }, [inCart]);

  useEffect(() => {
    if (inCart && line) setQtyStr(formatCartQuantityForInput(line.quantity));
  }, [inCart, line?.quantity]);

  const commitQtyField = () => {
    if (!line) return;
    const n = parseQtyInputString(qtyStr);
    if (n === null) {
      setQtyStr(formatCartQuantityForInput(line.quantity));
      return;
    }
    if (n <= 0) {
      setQuantity(productId, 0);
      return;
    }
    let next = n;
    if (stockCap != null && stockCap > 0) {
      next = Math.min(next, stockCap);
    }
    setQuantity(productId, next);
    setQtyStr(formatCartQuantityForInput(next));
  };

  const bumpCartQty = (delta: number) => {
    if (!line) return;
    let next = line.quantity + delta;
    if (stockCap != null && stockCap > 0) {
      next = Math.min(next, stockCap);
    }
    if (next <= 0 || !Number.isFinite(next)) {
      setQuantity(productId, 0);
      return;
    }
    setQuantity(productId, next);
  };

  const onAddFirst = () => {
    addProductQuantity(product, 1);
  };

  const atMax = stockCap != null && line != null && line.quantity >= stockCap;

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        ...(product.isManual
          ? { borderColor: "warning.light", bgcolor: "warning.50" }
          : {}),
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 1.25, "&:last-child": { pb: 1.25 } }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={0.5}>
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            title={product.name}
            sx={{ fontSize: "0.72rem", lineHeight: 1.25, flex: 1, minWidth: 0 }}
          >
            {product.name}
          </Typography>
          {product.isManual ? (
            <Chip
              label="Manual"
              size="small"
              color="warning"
              variant="outlined"
              sx={{ height: 18, fontSize: "0.55rem", flexShrink: 0, "& .MuiChip-label": { px: 0.5 } }}
            />
          ) : null}
        </Stack>
        {product.category ? (
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            noWrap
            sx={{ fontSize: "0.625rem", mt: 0.125 }}
          >
            {product.category}
          </Typography>
        ) : null}
        <Typography variant="body2" fontWeight={700} sx={{ mt: 0.35, fontSize: "0.8rem" }}>
          ₹{product.price.toFixed(2)}
          {product.unit ? (
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.35, fontSize: "0.625rem" }}>
              /{product.unit}
            </Typography>
          ) : null}
        </Typography>
        {hasStock ? (
          outOfStock ? (
            <Typography variant="caption" color="error" fontWeight={600} display="block" sx={{ fontSize: "0.625rem", mt: 0.125 }}>
              Out of Stock
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: "0.625rem", mt: 0.125 }}>
              Stock: {product.availableQuantity}
            </Typography>
          )
        ) : null}
      </CardContent>
      <CardActions sx={{ px: 1.25, pb: 1.25, pt: 0, flexDirection: "column", alignItems: "stretch", gap: 0.5 }}>
        {!inCart ? (
          <Button
            variant="contained"
            fullWidth
            size="small"
            onClick={onAddFirst}
            disabled={outOfStock}
            sx={{ fontSize: "0.72rem", py: 0.35, minHeight: 28 }}
          >
            {outOfStock ? "Add" : "Add"}
          </Button>
        ) : (
          <Stack direction="row" alignItems="center" spacing={0} justifyContent="center">
            <IconButton size="small" aria-label="Decrease quantity" onClick={() => bumpCartQty(-1)}>
              <RemoveIcon fontSize="small" />
            </IconButton>
            <TextField
              size="small"
              type="text"
              inputMode="decimal"
              value={qtyStr}
              onChange={(e) => setQtyStr(e.target.value)}
              onBlur={commitQtyField}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              sx={{ width: 50 }}
              slotProps={{
                htmlInput: {
                  min: 0,
                  max: stockCap,
                  style: { textAlign: "center", padding: "2px 0", fontSize: "0.75rem" },
                },
              }}
            />
            <IconButton size="small" aria-label="Increase quantity" disabled={atMax} onClick={() => bumpCartQty(1)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </CardActions>
    </Card>
  );
}

function EmptyProductsState({ hasSearch, allCount }: { hasSearch: boolean; allCount: number }) {
  const navigate = useNavigate();

  if (hasSearch) {
    return (
      <Typography color="text.secondary" sx={{ mt: 4 }}>
        No products match your search.
      </Typography>
    );
  }

  if (allCount === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <InventoryOutlinedIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          No products added yet
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 360, mx: "auto" }}>
          Go to Products Management to select the products you want to sell, set your prices and quantities.
        </Typography>
        <Button
          variant="contained"
          startIcon={<InventoryOutlinedIcon />}
          onClick={() => navigate("/products-management")}
        >
          Go to Products Management
        </Button>
      </Box>
    );
  }

  return null;
}

export const ProductList = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const { lines, itemCount } = useCart();
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [orderJustPlaced, setOrderJustPlaced] = useState(false);

  const showCart = lines.length > 0 || orderJustPlaced;

  const listQuery = useList<Product>({
    resource: "products",
    pagination: { mode: "off" },
    errorNotification: false,
    queryOptions: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
  });

  const products = useMemo(() => {
    const list = listQuery.result?.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p: Product) => p.name.toLowerCase().includes(q));
  }, [listQuery.result?.data, search]);

  if (listQuery.query.isPending) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (listQuery.query.isError) {
    return (
      <Typography color="error">
        Something went wrong loading products. Try again later.
      </Typography>
    );
  }

  const cartSidebar = (
    <Box
      sx={{
        width: isDesktop ? CART_WIDTH : "100%",
        minWidth: isDesktop ? CART_WIDTH : "auto",
        flexShrink: 0,
        height: isDesktop ? "calc(100vh - 120px)" : "100%",
        position: isDesktop ? "sticky" : "static",
        top: isDesktop ? 80 : "auto",
        borderLeft: isDesktop ? 1 : 0,
        borderColor: "divider",
        pl: isDesktop ? 3 : 0,
        pr: isDesktop ? 2 : 0,
        ml: isDesktop ? 2 : 0,
        px: isDesktop ? undefined : 2.5,
        py: isDesktop ? 0 : 2,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <InlineCart
        onOrderPlaced={() => {
          setOrderJustPlaced(true);
          setDrawerOpen(false);
        }}
        onNewOrder={() => setOrderJustPlaced(false)}
      />
    </Box>
  );

  return (
    <Box sx={{ display: "flex", gap: 0, overflow: "hidden" }}>
      {/* ── Products section ── */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          pr: isDesktop && showCart ? 1.5 : 0,
        }}
      >
        <Box sx={{ mb: 3, maxWidth: { xs: "100%", sm: 400 } }}>
          <TextField
            fullWidth
            size="medium"
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{
              "& .MuiInputBase-input": { fontSize: "0.95rem", py: 1.1 },
              "& .MuiInputBase-root": { minHeight: 44 },
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="medium" color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        <Grid container spacing={1.25}>
          {products.map((product: Product) => (
            <Grid
              item
              xs={4}
              sm={3}
              md={isDesktop && showCart ? 4 : 3}
              lg={isDesktop && showCart ? 3 : 2}
              xl={2}
              key={product.productId}
            >
              <ProductCard product={product} />
            </Grid>
          ))}
        </Grid>

        {products.length === 0 && (
          <EmptyProductsState
            hasSearch={search.trim().length > 0}
            allCount={(listQuery.result?.data ?? []).length}
          />
        )}
      </Box>

      {/* ── Desktop: inline cart sidebar ── */}
      {isDesktop && showCart && cartSidebar}

      {/* ── Mobile: cart drawer ── */}
      {!isDesktop && (
        <>
          <Drawer
            anchor="right"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            slotProps={{
              paper: { sx: { width: "min(90vw, 400px)", p: 0 } },
              backdrop: { sx: { backgroundColor: "rgba(0,0,0,0.3)" } },
            }}
          >
            <Box sx={{ height: "100%", p: 2 }}>
              <InlineCart
                onOrderPlaced={() => setOrderJustPlaced(true)}
                onNewOrder={() => {
                  setOrderJustPlaced(false);
                  setDrawerOpen(false);
                }}
              />
            </Box>
          </Drawer>

          <Fab
            color="primary"
            size="large"
            aria-label={`Cart with ${itemCount} items`}
            onClick={() => setDrawerOpen(true)}
            sx={{
              position: "fixed",
              bottom: 20,
              right: 20,
              zIndex: (t) => t.zIndex.fab,
              boxShadow: 6,
            }}
          >
            <Badge
              badgeContent={itemCount > 0 ? formatCartQuantityForInput(itemCount) : undefined}
              color="error"
              max={99}
            >
              <ShoppingCartIcon />
            </Badge>
          </Fab>
        </>
      )}
    </Box>
  );
};
