import { useEffect, useMemo, useState } from "react";
import { keys, useList, useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
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
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import type { Product } from "../../types/product";
import { API_BASE_URL } from "../../config";
import { getApiHeaders } from "../../providers/authProvider";
import { useOutlet } from "../../context/outlet-context";
import { createManualProduct, isManualProductId } from "../../utils/manualProducts";

interface SelectedProduct {
  productId: string;
  name: string;
  category?: string;
  unit?: string;
  price: number;
  quantity: number;
  isManual?: boolean;
  /** Included in outlet on save. Unchecking keeps the row visible until Save. */
  checked: boolean;
  /** Loaded from server — unchecked rows stay in Added until Save. */
  wasSaved?: boolean;
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
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualUnit, setManualUnit] = useState("");
  const [manualQuantity, setManualQuantity] = useState("0");

  const listQuery = useList<Product>({
    resource: "all-products",
    pagination: { mode: "off" },
    errorNotification: false,
    queryOptions: { staleTime: 5 * 60 * 1000 },
  });

  const allProducts = useMemo(() => listQuery.result?.data ?? [], [listQuery.result?.data]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProducts) {
      const c = p.category?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allProducts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [allProducts, search]);

  const isInAddedSection = (sp: SelectedProduct | undefined) =>
    Boolean(sp && (sp.checked || sp.wasSaved));

  const selectedFiltered = useMemo(
    () =>
      filtered.filter((p) => {
        const id = p.productId ?? p.id;
        const sp = selection[id];
        if (!sp || sp.isManual || isManualProductId(sp.productId)) return false;
        return isInAddedSection(sp);
      }),
    [filtered, selection],
  );
  const unselectedFiltered = useMemo(
    () =>
      filtered.filter((p) => {
        const id = p.productId ?? p.id;
        const sp = selection[id];
        if (!sp) return true;
        if (sp.isManual || isManualProductId(sp.productId)) return false;
        return !sp.checked && !sp.wasSaved;
      }),
    [filtered, selection],
  );

  const manualInSelection = useMemo(
    () =>
      Object.values(selection).filter(
        (sp) =>
          (sp.isManual || isManualProductId(sp.productId)) && isInAddedSection(sp),
      ),
    [selection],
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
              const isManual =
                (sp as SelectedProduct).isManual === true ||
                isManualProductId(sp.productId);
              map[sp.productId] = {
                productId: sp.productId,
                name: sp.name ?? "",
                category: sp.category,
                unit: sp.unit,
                price: Number(sp.price) || 0,
                quantity: Number(sp.quantity) || 0,
                checked: true,
                wasSaved: true,
                ...(isManual ? { isManual: true } : {}),
              };
            }
          }
          setSelection(map);
          setSaved(true);
          setDirty(false);
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

  const toggleSelect = (product: Product) => {
    const id = product.productId ?? product.id;
    setSaved(false);
    setDirty(true);
    setSelection((prev) => {
      if (id in prev) {
        const current = prev[id];
        if (current.checked) {
          if (current.wasSaved) {
            return { ...prev, [id]: { ...current, checked: false } };
          }
          const next = { ...prev };
          delete next[id];
          return next;
        }
        return { ...prev, [id]: { ...current, checked: true } };
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
          checked: true,
        },
      };
    });
  };

  const toggleManualSelect = (productId: string) => {
    setSaved(false);
    setDirty(true);
    setSelection((prev) => {
      if (!(productId in prev)) return prev;
      const current = prev[productId];
      if (current.checked) {
        if (current.wasSaved) {
          return { ...prev, [productId]: { ...current, checked: false } };
        }
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: { ...current, checked: true } };
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

  const selectedCount = useMemo(
    () => Object.values(selection).filter((sp) => sp.checked).length,
    [selection],
  );

  const resetManualForm = () => {
    setManualName("");
    setManualCategory("");
    setManualPrice("");
    setManualUnit("");
    setManualQuantity("");
  };

  const openAddManualDialog = () => {
    resetManualForm();
    setAddDialogOpen(true);
  };

  const canSaveManual = useMemo(() => {
    const name = manualName.trim();
    const category = manualCategory.trim();
    const unit = manualUnit.trim();
    const priceStr = manualPrice.trim();
    const qtyStr = manualQuantity.trim();
    if (!name || !category || !unit || !priceStr || !qtyStr) return false;
    const price = Number(priceStr);
    const quantity = Number(qtyStr);
    return (
      Number.isFinite(price) &&
      price >= 0 &&
      Number.isFinite(quantity) &&
      quantity >= 0
    );
  }, [manualName, manualCategory, manualUnit, manualPrice, manualQuantity]);

  const handleAddManualProduct = () => {
    if (!canSaveManual) return;
    const name = manualName.trim();
    const category = manualCategory.trim();
    const unit = manualUnit.trim();
    const price = Number(manualPrice);
    const quantity = Number(manualQuantity);
    const product = createManualProduct({
      name,
      category,
      price,
      unit,
      quantity,
    });
    setSaved(false);
    setDirty(true);
    setSelection((prev) => ({
      ...prev,
      [product.productId]: {
        productId: product.productId,
        name: product.name,
        category: product.category,
        unit: product.unit,
        price: product.price,
        quantity: product.availableQuantity ?? 0,
        isManual: true,
        checked: true,
      },
    }));
    setAddDialogOpen(false);
    resetManualForm();
  };

  const handleSave = async () => {
    const products = Object.values(selection)
      .filter((sp) => sp.checked)
      .map((sp) => ({
      productId: sp.productId,
      name: sp.name,
      category: sp.category || undefined,
      unit: sp.unit || undefined,
      price: sp.price,
      quantity: sp.quantity,
      ...(sp.isManual ? { isManual: true } : {}),
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
        setSelection((prev) => {
          const next: SelectionMap = {};
          for (const sp of Object.values(prev)) {
            if (sp.checked) {
              next[sp.productId] = { ...sp, checked: true, wasSaved: true };
            }
          }
          return next;
        });
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
            variant="outlined"
            color="warning"
            startIcon={<AddCircleOutlineIcon />}
            onClick={openAddManualDialog}
            sx={{ whiteSpace: "nowrap" }}
          >
            Add Manual Product
          </Button>
          <Button
            variant="contained"
            color={!dirty && saved ? "success" : "primary"}
            startIcon={!dirty && saved ? <CheckCircleIcon /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving ? "Saving…" : !dirty && saved ? "Saved" : "Save"}
          </Button>
        </Stack>
      </Stack>

      {/* ── Manual Products ── */}
      {manualInSelection.length > 0 && (
        <>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }} color="warning.main">
            Manual Products ({manualInSelection.length})
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, overflowX: "auto", borderColor: "warning.light" }}>
            <Table size="small" sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "warning.50" }}>
                  <TableCell padding="checkbox" />
                  <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Your Price (₹)</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Quantity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {manualInSelection.map((sp) => (
                  <TableRow
                    key={sp.productId}
                    hover
                    onClick={() => toggleManualSelect(sp.productId)}
                    sx={{
                      cursor: "pointer",
                      bgcolor: sp.checked ? "action.selected" : "action.hover",
                      opacity: sp.checked ? 1 : 0.72,
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox checked={sp.checked} tabIndex={-1} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Typography variant="body2" fontWeight={500}>{sp.name}</Typography>
                        <Chip label="Manual" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: "0.65rem" }} />
                      </Stack>
                      {sp.unit ? (
                        <Typography variant="caption" color="text.secondary">per {sp.unit}</Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{sp.category || "—"}</Typography>
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <TextField
                        size="small"
                        type="number"
                        value={sp.price}
                        onChange={(e) => updateField(sp.productId, "price", e.target.value)}
                        sx={{ width: 100 }}
                        slotProps={{ htmlInput: { min: 0, step: 0.01, style: { textAlign: "right" } } }}
                      />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <TextField
                        size="small"
                        type="number"
                        value={sp.quantity}
                        onChange={(e) => updateField(sp.productId, "quantity", e.target.value)}
                        sx={{ width: 90 }}
                        slotProps={{ htmlInput: { min: 0, style: { textAlign: "right" } } }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

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
                      sx={{
                        cursor: "pointer",
                        bgcolor: sp.checked ? "action.selected" : "action.hover",
                        opacity: sp.checked ? 1 : 0.72,
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox checked={sp.checked} tabIndex={-1} />
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

      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Add Manual Product</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Manual products are outlet-specific and tagged separately from the master catalog.
            Save to make them available on the POS screen.
          </Typography>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label="Product name"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              required
              autoFocus
              fullWidth
            />
            {categoryOptions.length > 0 ? (
              <FormControl fullWidth required>
                <InputLabel id="manual-category-label">Category</InputLabel>
                <Select
                  labelId="manual-category-label"
                  label="Category"
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                >
                  {categoryOptions.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Typography variant="body2" color="error">
                No categories found in the master catalog. Load catalog products first.
              </Typography>
            )}
            <TextField
              label="Price (₹)"
              type="number"
              value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value)}
              required
              fullWidth
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
            />
            <TextField
              label="Unit"
              value={manualUnit}
              onChange={(e) => setManualUnit(e.target.value)}
              placeholder="e.g. kg, pcs"
              required
              fullWidth
            />
            <TextField
              label="Quantity"
              type="number"
              value={manualQuantity}
              onChange={(e) => setManualQuantity(e.target.value)}
              required
              fullWidth
              slotProps={{ htmlInput: { min: 0 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleAddManualProduct}
            disabled={!canSaveManual || categoryOptions.length === 0}
          >
            Add Product
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
