import { useEffect, useMemo, useState } from "react";
import { keys, useList, useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import type { Product } from "../../types/product";
import { API_BASE_URL } from "../../config";
import { getApiHeaders } from "../../providers/authProvider";
import { useOutlet } from "../../context/outlet-context";

interface SelectedProduct {
  productId: string;
  name: string;
  category?: string;
  unit?: string;
  price: number;
  quantity: number;
}

type SelectionMap = Record<string, SelectedProduct>;

export const ProductsManagementPage = () => {
  const queryClient = useQueryClient();
  const notification = useNotification();
  const { outletId } = useOutlet();
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [selection, setSelection] = useState<SelectionMap>({});
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const listQuery = useList<Product>({
    resource: "all-products",
    pagination: { mode: "off" },
    queryOptions: { staleTime: 5 * 60 * 1000 },
  });

  const allProducts = useMemo(() => listQuery.result?.data ?? [], [listQuery.result?.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [allProducts, search]);

  const selectedFiltered = useMemo(
    () => filtered.filter((p) => (p.productId ?? p.id) in selection),
    [filtered, selection],
  );
  const unselectedFiltered = useMemo(
    () => filtered.filter((p) => !((p.productId ?? p.id) in selection)),
    [filtered, selection],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `${API_BASE_URL}/outlet-products?outletId=${encodeURIComponent(outletId)}`,
          { headers: getApiHeaders() },
        );
        if (!res.ok) {
          setLoadingSaved(false);
          return;
        }
        const json = await res.json();
        const raw = json?.data?.products ?? json?.products ?? json?.data;
        let list: SelectedProduct[] = [];
        if (Array.isArray(raw)) {
          list = raw;
        } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          list = Object.values(raw) as SelectedProduct[];
        } else if (Array.isArray(json)) {
          list = json;
        }
        if (!cancelled && list.length > 0) {
          const map: SelectionMap = {};
          for (const sp of list) {
            if (sp.productId) {
              map[sp.productId] = {
                productId: sp.productId,
                name: sp.name ?? "",
                category: sp.category,
                unit: sp.unit,
                price: Number(sp.price) || 0,
                quantity: Number(sp.quantity) || 0,
              };
            }
          }
          setSelection(map);
        }
      } catch {
        /* first time — no saved products yet */
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const isSelected = (id: string) => id in selection;

  const toggleSelect = (product: Product) => {
    const id = product.productId ?? product.id;
    setSaved(false);
    setDirty(true);
    setSelection((prev) => {
      if (id in prev) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return {
        ...prev,
        [id]: {
          productId: id,
          name: product.name,
          category: product.category,
          unit: product.unit,
          price: product.price,
          quantity: product.availableQuantity ?? 0,
        },
      };
    });
  };

  const updateField = (id: string, field: "price" | "quantity", value: string) => {
    setSaved(false);
    setDirty(true);
    setSelection((prev) => {
      if (!(id in prev)) return prev;
      const num = Number(value);
      return {
        ...prev,
        [id]: { ...prev[id], [field]: Number.isFinite(num) && num >= 0 ? num : prev[id][field] },
      };
    });
  };

  const selectedCount = Object.keys(selection).length;

  const handleSave = async () => {
    const products = Object.values(selection).map((sp) => ({
      productId: sp.productId,
      name: sp.name,
      category: sp.category || undefined,
      unit: sp.unit || undefined,
      price: sp.price,
      quantity: sp.quantity,
    }));

    const payload = {
      outletId,
      products,
    };

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/outlet-products`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);

      if (res.ok && body?.success !== false) {
        setSaved(true);
        setDirty(false);
        await queryClient.invalidateQueries({
          queryKey: keys().data().resource("products").action("list").get(),
        });
        notification.open?.({
          type: "success",
          message: "Products saved",
          description: `${products.length} product(s) saved for this outlet.`,
        });
      } else {
        const msg = body?.message || `Server returned ${res.status}`;
        notification.open?.({ type: "error", message: "Save failed", description: msg });
      }
    } catch {
      notification.open?.({ type: "error", message: "Could not reach server" });
    } finally {
      setSaving(false);
    }
  };

  if (listQuery.query.isPending || loadingSaved) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (listQuery.query.isError) {
    return <Typography color="error">Could not load products. Try again later.</Typography>;
  }

  return (
    <Box sx={{ overflow: "hidden" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} flexWrap="wrap" gap={2} mb={2}>
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ minWidth: 0 }}>
          <Typography variant="h5" component="h1" noWrap>Products Management</Typography>
          {selectedCount > 0 && (
            <Chip label={`${selectedCount} selected`} color="primary" size="small" />
          )}
        </Stack>
        <Stack direction="row" gap={1.5} alignItems="center">
          <TextField
            size="small"
            placeholder="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 200 }}
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
          <Button
            variant="contained"
            color={saved && !dirty ? "success" : "primary"}
            startIcon={saved && !dirty ? <CheckCircleIcon /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || (saved && !dirty)}
          >
            {saving ? "Saving…" : saved && !dirty ? "Saved" : "Save"}
          </Button>
        </Stack>
      </Stack>

      {/* ── Added Products ── */}
      {selectedFiltered.length > 0 && (
        <>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }} color="primary">
            Added Products ({selectedFiltered.length})
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "primary.50" }}>
                  <TableCell padding="checkbox" />
                  <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Master Price</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Your Price (₹)</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Quantity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedFiltered.map((product) => {
                  const id = product.productId ?? product.id;
                  const sp = selection[id];
                  return (
                    <TableRow
                      key={id}
                      hover
                      onClick={() => toggleSelect(product)}
                      sx={{ cursor: "pointer", bgcolor: "action.selected" }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox checked tabIndex={-1} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{product.name}</Typography>
                        {product.unit && (
                          <Typography variant="caption" color="text.secondary">per {product.unit}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{product.category || "—"}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">₹{product.price.toFixed(2)}</Typography>
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <TextField
                          size="small"
                          type="number"
                          value={sp.price}
                          onChange={(e) => updateField(id, "price", e.target.value)}
                          sx={{ width: 100 }}
                          slotProps={{ htmlInput: { min: 0, step: 0.01, style: { textAlign: "right" } } }}
                        />
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <TextField
                          size="small"
                          type="number"
                          value={sp.quantity}
                          onChange={(e) => updateField(id, "quantity", e.target.value)}
                          sx={{ width: 90 }}
                          slotProps={{ htmlInput: { min: 0, style: { textAlign: "right" } } }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* ── Available Products ── */}
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }} color="text.secondary">
        Available Products ({unselectedFiltered.length})
      </Typography>
      {unselectedFiltered.length > 0 ? (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 600 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Master Price</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Your Price (₹)</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Quantity</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {unselectedFiltered.map((product) => {
                const id = product.productId ?? product.id;
                return (
                  <TableRow
                    key={id}
                    hover
                    onClick={() => toggleSelect(product)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox checked={false} tabIndex={-1} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{product.name}</Typography>
                      {product.unit && (
                        <Typography variant="caption" color="text.secondary">per {product.unit}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{product.category || "—"}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">₹{product.price.toFixed(2)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.disabled">—</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.disabled">—</Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Paper variant="outlined" sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            {filtered.length === 0 ? "No products match your search." : "All products have been added!"}
          </Typography>
        </Paper>
      )}
    </Box>
  );
};
