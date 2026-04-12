import { useEffect, useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useQueryClient } from "@tanstack/react-query";
import { keys, useList, useNotification } from "@refinedev/core";
import {
  buildSaleUpdatePayload,
  patchSale,
  previewSaleTotals,
} from "../api/saleUpdate";
import { useOutlet } from "../context/outlet-context";
import type { Product } from "../types/product";
import type { SaleOrderDiscount, SaleLineItem, SalesGridRow } from "../types/sale";

type LocalLine = SaleLineItem & { key: string };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function newKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** One row per `productId` (or name+unitPrice if id missing). Combines qty and blended unit price. */
function mergeLinesByProduct(lines: LocalLine[]): LocalLine[] {
  const merged = new Map<string, LocalLine>();
  const keyOrder: string[] = [];

  for (const line of lines) {
    const pid = String(line.productId ?? "").trim();
    const key =
      pid !== ""
        ? `id:${pid}`
        : `fb:${line.name.trim().toLowerCase()}@${round2(line.unitPrice)}`;

    const hit = merged.get(key);
    if (!hit) {
      merged.set(key, {
        ...line,
        key: newKey(),
        lineTotal: round2(line.unitPrice * line.quantity),
      });
      keyOrder.push(key);
    } else {
      const q1 = hit.quantity;
      const q2 = line.quantity;
      const newQ = q1 + q2;
      const blended =
        newQ > 0
          ? round2((hit.unitPrice * q1 + line.unitPrice * q2) / newQ)
          : hit.unitPrice;
      merged.set(key, {
        ...hit,
        quantity: newQ,
        unitPrice: blended,
        lineTotal: round2(blended * newQ),
      });
    }
  }

  return keyOrder.map((k) => merged.get(k)!);
}

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function initDiscountFromRow(d: SaleOrderDiscount | undefined): {
  type: "%" | "₹";
  input: string;
} {
  if (d == null) return { type: "₹", input: "" };
  if (typeof d === "number") {
    return { type: "₹", input: d === 0 ? "" : String(d) };
  }
  const o = d as { type?: string; value?: number; amount?: number };
  if (o.type === "%") {
    return { type: "%", input: o.value != null ? String(o.value) : "" };
  }
  if (o.type === "₹") {
    return { type: "₹", input: String(o.value ?? o.amount ?? "") };
  }
  return { type: "₹", input: o.amount != null ? String(o.amount) : "" };
}

type SalePaymentMode = "Cash" | "Card" | "UPI";

function initPaymentMode(raw: string | undefined): SalePaymentMode {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "cash") return "Cash";
  if (s === "card") return "Card";
  if (s === "upi") return "UPI";
  return "Cash";
}

type EditSaleDialogProps = {
  open: boolean;
  row: SalesGridRow | null;
  onClose: () => void;
};

export function EditSaleDialog({ open, row, onClose }: EditSaleDialogProps) {
  const { outletId: sessionOutletId } = useOutlet();
  const notification = useNotification();
  const queryClient = useQueryClient();
  const productsQuery = useList<Product>({
    resource: "products",
    pagination: { mode: "off" },
    queryOptions: { enabled: open },
  });
  const products = productsQuery.result?.data ?? [];

  const [lines, setLines] = useState<LocalLine[]>([]);
  const [discountType, setDiscountType] = useState<"%" | "₹">("₹");
  const [discountInput, setDiscountInput] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addProduct, setAddProduct] = useState<Product | null>(null);
  const [paymentMode, setPaymentMode] = useState<SalePaymentMode>("Cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [saving, setSaving] = useState(false);

  /**
   * Init only when opening or switching rows (`row.id`). Do not depend on `row` object
   * identity — parent rebuilds rows each render and would wipe locally added lines.
   */
  useEffect(() => {
    if (!open || !row) return;
    setLines(
      mergeLinesByProduct(
        row.rawItems.map((l) => ({
          ...l,
          key: newKey(),
          lineTotal: round2(l.unitPrice * l.quantity),
        })),
      ),
    );
    const disc = initDiscountFromRow(row.discount);
    setDiscountType(disc.type);
    setDiscountInput(disc.input);
    setPaymentMode(initPaymentMode(row.paymentMode));
    setCustomerName(row.customer?.name ?? "");
    setCustomerPhone(row.customer?.phone ?? "");
    setCustomerAddress(row.customer?.address ?? "");
    setAddProduct(null);
    setAddQty("1");
  }, [open, row?.id]);

  const outletId = row?.outletId ?? sessionOutletId ?? "";

  const lineSubtotal = useMemo(
    () =>
      round2(
        lines
          .filter((l) => l.quantity > 0)
          .reduce((s, l) => s + l.unitPrice * l.quantity, 0),
      ),
    [lines],
  );

  const discountValue = useMemo(() => {
    const v = Number(discountInput);
    if (!Number.isFinite(v) || v < 0) return 0;
    if (discountType === "%") return round2((Math.min(v, 100) / 100) * lineSubtotal);
    return round2(Math.min(v, lineSubtotal));
  }, [discountInput, discountType, lineSubtotal]);

  const orderDiscount = useMemo((): SaleOrderDiscount | undefined => {
    if (discountValue <= 0) return undefined;
    return {
      type: discountType,
      value: Number(discountInput) || 0,
      amount: discountValue,
    };
  }, [discountValue, discountType, discountInput]);

  const totalsPreview = useMemo(() => {
    if (!row) {
      return {
        subtotal: 0,
        discountAmount: 0,
        total: 0,
        discount: undefined as SaleOrderDiscount | undefined,
      };
    }
    return previewSaleTotals(lines, orderDiscount);
  }, [lines, row, orderDiscount]);

  const canSave = useMemo(() => {
    if (!row?.documentId || !outletId) return false;
    if (lines.length === 0) return false;
    return lines.every(
      (l) =>
        l.quantity > 0 &&
        String(l.productId ?? "").trim() !== "" &&
        l.unitPrice >= 0,
    );
  }, [row?.documentId, outletId, lines]);

  const handleQtyChange = (key: string, raw: string) => {
    const q = Number(raw);
    if (!Number.isFinite(q) || q < 0) return;
    setLines((prev) =>
      prev.map((l) =>
        l.key === key
          ? {
              ...l,
              quantity: q,
              lineTotal: round2(l.unitPrice * q),
            }
          : l,
      ),
    );
  };

  const handleRemove = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const handleAddLine = () => {
    if (!addProduct) return;
    const q = Math.max(1, Math.floor(Number(addQty) || 1));
    setLines((prev) =>
      mergeLinesByProduct([
        {
          key: newKey(),
          productId: addProduct.productId,
          name: addProduct.name,
          unitPrice: addProduct.price,
          quantity: q,
          lineTotal: round2(addProduct.price * q),
        },
        ...prev,
      ]),
    );
    setAddProduct(null);
    setAddQty("1");
  };

  const handleSave = async () => {
    if (!row?.documentId) {
      notification.open?.({
        type: "error",
        message: "Cannot update sale",
        description: "Missing document id from server. Reload sales and try again.",
      });
      return;
    }
    if (!outletId) {
      notification.open?.({
        type: "error",
        message: "No outlet",
        description: "Sign in again or pick an outlet.",
      });
      return;
    }
    if (!canSave) {
      notification.open?.({
        type: "error",
        message: "Invalid lines",
        description: "Each line needs a product id and quantity greater than 0.",
      });
      return;
    }

    const bareLines: SaleLineItem[] = lines.map(
      ({ key: _k, ...rest }) => rest,
    );
    const payload = buildSaleUpdatePayload(
      outletId,
      {
        name: customerName.trim() || undefined,
        phone: customerPhone.trim() || undefined,
        address: customerAddress.trim() || undefined,
      },
      bareLines,
      orderDiscount,
      paymentMode,
      row.plainSaleId,
    );

    setSaving(true);
    try {
      const res = await patchSale(row.documentId, payload);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          (body && typeof body === "object" && "message" in body
            ? String((body as { message: unknown }).message)
            : null) || `HTTP ${res.status}`;
        notification.open?.({
          type: "error",
          message: "Update failed",
          description: msg,
        });
        return;
      }
      notification.open?.({
        type: "success",
        message: "Sale updated",
      });
      await queryClient.invalidateQueries({
        queryKey: keys().data().resource("sales").action("list").get(),
      });
      onClose();
    } catch {
      notification.open?.({
        type: "error",
        message: "Network error",
        description: "Could not reach the server.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!row) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit sale {row.salesId}</DialogTitle>
      <DialogContent
        sx={{
          overflow: "auto",
          maxHeight: "min(70vh, 560px)",
        }}
      >
        {!row.documentId ? (
          <Typography color="error" sx={{ py: 1 }}>
            This row has no API document id (`id`). The backend must return a stable id on{" "}
            <code>GET /Sales</code> for updates to work.
          </Typography>
        ) : null}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Edit customer, lines, discount, payment mode, then save.
        </Typography>

        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
            Customer (optional)
          </Typography>
          <Stack spacing={1}>
            <TextField
              label="Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Phone"
              value={customerPhone}
              onChange={(e) =>
                setCustomerPhone(
                  e.target.value.replace(/\D/g, "").slice(0, 10),
                )
              }
              fullWidth
              size="small"
              slotProps={{
                htmlInput: {
                  maxLength: 10,
                  inputMode: "numeric",
                  autoComplete: "tel",
                },
              }}
            />
            <TextField
              label="Address"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              fullWidth
              size="small"
              multiline
              minRows={1}
            />
          </Stack>
        </Paper>

        <Stack spacing={2}>
          {lines.map((line) => (
            <Stack
              key={line.key}
              direction="row"
              spacing={1}
              alignItems="flex-start"
              sx={{ flexWrap: "wrap" }}
            >
              <Box sx={{ flex: "1 1 160px", minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap title={line.name}>
                  {line.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {line.productId ? line.productId : "— no productId —"} · ₹
                  {line.unitPrice.toFixed(2)} × {line.quantity} = ₹
                  {line.lineTotal.toFixed(2)}
                </Typography>
              </Box>
              <TextField
                size="small"
                label="Qty"
                type="number"
                value={line.quantity}
                onChange={(e) => handleQtyChange(line.key, e.target.value)}
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
                sx={{ width: 88 }}
              />
              <IconButton
                aria-label="Remove line"
                onClick={() => handleRemove(line.key)}
                color="error"
                size="small"
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Stack>
          ))}

          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ flexWrap: "nowrap", width: "100%", minWidth: 0 }}
          >
            <ToggleButtonGroup
              value={discountType}
              exclusive
              onChange={(_, v) => {
                if (v) setDiscountType(v);
              }}
              size="small"
              sx={{ flexShrink: 0, height: 40 }}
            >
              <ToggleButton value="₹" sx={{ px: 1.2, fontWeight: 700, fontSize: "0.85rem" }}>
                ₹
              </ToggleButton>
              <ToggleButton value="%" sx={{ px: 1.2, fontWeight: 700, fontSize: "0.85rem" }}>
                %
              </ToggleButton>
            </ToggleButtonGroup>
            <TextField
              size="small"
              label={discountType === "%" ? "Discount (%)" : "Discount (₹)"}
              type="number"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1, minWidth: 0 }}
              slotProps={{
                htmlInput: {
                  min: 0,
                  max: discountType === "%" ? 100 : lineSubtotal,
                  step: "any",
                },
              }}
            />
          </Stack>

          <Box
            sx={{
              mt: 1,
              pt: 2,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={0.75}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="body2" color="text.secondary">
                  Subtotal
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatInr(totalsPreview.subtotal)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Discount (−)
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {orderDiscount == null
                      ? "No discount"
                      : discountType === "%"
                        ? `${Number(discountInput) || 0}% of subtotal`
                        : `₹${Number(discountInput) || 0} off subtotal`}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  color={totalsPreview.discountAmount > 0 ? "error.main" : "text.secondary"}
                >
                  {totalsPreview.discountAmount > 0
                    ? `−${formatInr(totalsPreview.discountAmount)}`
                    : formatInr(0)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="subtitle1" fontWeight={700}>
                  Total
                </Typography>
                <Typography variant="subtitle1" fontWeight={700}>
                  {formatInr(totalsPreview.total)}
                </Typography>
              </Stack>
            </Stack>
          </Box>

          <TextField
            select
            label="Payment mode"
            value={paymentMode}
            onChange={(e) =>
              setPaymentMode(e.target.value as SalePaymentMode)
            }
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
          >
            <MenuItem value="Cash">Cash</MenuItem>
            <MenuItem value="Card">Card</MenuItem>
            <MenuItem value="UPI">UPI</MenuItem>
          </TextField>

          <Typography variant="subtitle2" sx={{ pt: 1 }}>
            Add item
          </Typography>
          <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap">
            <Autocomplete
              sx={{ flex: "1 1 200px", minWidth: 0 }}
              options={products}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a?.productId === b?.productId}
              value={addProduct}
              onChange={(_, v) => setAddProduct(v)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Product"
                  size="small"
                  placeholder="Search products"
                  InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
                />
              )}
              disabled={productsQuery.query.isPending}
            />
            <TextField
              size="small"
              label="Qty"
              type="number"
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
              sx={{ width: 80 }}
            />
            <Button variant="outlined" onClick={handleAddLine} disabled={!addProduct}>
              Add
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={saving || !canSave}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
