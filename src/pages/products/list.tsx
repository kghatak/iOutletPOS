import { useEffect, useMemo, useState } from "react";
import { useList, useNotification } from "@refinedev/core";
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
import SearchIcon from "@mui/icons-material/Search";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import type { Product } from "../../types/product";
import {
  formatCartQuantityForInput,
  parseQtyInputString,
} from "../../types/cart";
import { useCart } from "../../context/cart-context";
import { FloatingCartMenu } from "../../components/FloatingCartMenu";

function ProductCard({ product }: { product: Product }) {
  const notification = useNotification();
  const { lines, addProductQuantity, setQuantity } = useCart();
  const productId = product.productId ?? product.id;
  const line = lines.find((l) => l.productId === productId);
  const inCart = Boolean(line);
  const stockCap =
    product.availableQuantity != null && product.availableQuantity > 0
      ? product.availableQuantity
      : undefined;
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
    notification.open?.({
      type: "success",
      message: "Added to cart",
      description: `1 × ${product.name}`,
    });
  };

  const atMax = stockCap != null && line != null && line.quantity >= stockCap;

  return (
    <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {product.name}
        </Typography>
        {product.category ? (
          <Typography variant="caption" color="text.secondary" display="block">
            {product.category}
          </Typography>
        ) : null}
        <Typography variant="h6" sx={{ mt: 1 }}>
          ₹{product.price.toFixed(2)}
          {product.unit ? (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
              / {product.unit}
            </Typography>
          ) : null}
        </Typography>
        {stockCap != null ? (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Up to {stockCap} in stock
          </Typography>
        ) : null}
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, flexDirection: "column", alignItems: "stretch", gap: 1 }}>
        {!inCart ? (
          <Button variant="contained" fullWidth onClick={onAddFirst}>
            Add
          </Button>
        ) : (
          <Stack direction="row" alignItems="center" spacing={0.5} justifyContent="center">
            <IconButton
              size="small"
              aria-label="Decrease quantity"
              onClick={() => bumpCartQty(-1)}
            >
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
              sx={{ width: 96 }}
              slotProps={{
                htmlInput: {
                  min: 0,
                  max: stockCap,
                  style: { textAlign: "center" },
                },
              }}
            />
            <IconButton
              size="small"
              aria-label="Increase quantity"
              disabled={atMax}
              onClick={() => bumpCartQty(1)}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </CardActions>
    </Card>
  );
}

export const ProductList = () => {
  const [search, setSearch] = useState("");

  const listQuery = useList<Product>({
    resource: "products",
    pagination: { mode: "off" },
    queryOptions: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
  });

  const products = useMemo(() => {
    const list = listQuery.result?.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p: Product) =>
      p.name.toLowerCase().includes(q),
    );
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

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={2}
        mb={3}
      >
        <Box>
          <Typography variant="h5" component="h1" gutterBottom>
            Products
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Browse products, add to cart, then confirm on the Cart page.
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
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

      <Grid container spacing={2}>
        {products.map((product: Product) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={product.productId}>
            <ProductCard product={product} />
          </Grid>
        ))}
      </Grid>

      {products.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4 }}>
          No products match your search.
        </Typography>
      ) : null}

      <FloatingCartMenu />
    </Box>
  );
};
