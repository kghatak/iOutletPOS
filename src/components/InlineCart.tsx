import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import ShoppingCartCheckoutIcon from "@mui/icons-material/ShoppingCartCheckout";
import PrintIcon from "@mui/icons-material/Print";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import Chip from "@mui/material/Chip";
import { useQueryClient } from "@tanstack/react-query";
import { keys, useNotification } from "@refinedev/core";
import { useCart } from "../context/cart-context";
import { useOutlet } from "../context/outlet-context";
import type { CartLine } from "../types/cart";
import {
  cartLinesToSalePayloadItems,
  formatCartQuantityForLine,
  formatInrAmountForInput,
  lineSubtotal,
  normalizeCartQuantity,
  parseInrAmountString,
  parseQtyInputString,
} from "../types/cart";
import { getApiHeaders, getSessionCashierName } from "../providers/authProvider";
import {
  invoiceReceiptStamp,
  printThermalInvoice,
  type InvoiceData,
} from "../utils/thermalInvoice";
import { enqueueOrder, removeFromQueue } from "../utils/offlineQueue";
import {
  extractCreatedSaleId,
  extractSalesCreateFailureHint,
  getSalesCreatePostUrl,
  isSalesCreateResponseSuccess,
} from "../utils/salesCreate";

const compactInputSx = {
  "& .MuiInputBase-root": { fontSize: "0.72rem" },
  "& .MuiInputBase-input": { py: 0.65 },
  "& .MuiInputLabel-root": { fontSize: "0.72rem" },
} as const;

type PosPaymentMode = "Cash" | "Card" | "UPI" | "Due";

function CartLineRow({
  line,
  setQuantity,
  applyLineRupeeAmount,
  removeLine,
}: {
  line: CartLine;
  setQuantity: (productId: string, quantity: number) => void;
  applyLineRupeeAmount: (productId: string, rupees: number) => void;
  removeLine: (productId: string) => void;
}) {
  const [text, setText] = useState(() => formatCartQuantityForLine(line));
  const [amtText, setAmtText] = useState(() =>
    formatInrAmountForInput(lineSubtotal(line)),
  );
  const [qtyFocused, setQtyFocused] = useState(false);
  const [rupeeAmtFocused, setRupeeAmtFocused] = useState(false);
  const rupeeApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRupeeApplyTimer = () => {
    if (rupeeApplyTimerRef.current != null) {
      clearTimeout(rupeeApplyTimerRef.current);
      rupeeApplyTimerRef.current = null;
    }
  };

  useEffect(() => () => clearRupeeApplyTimer(), []);

  useEffect(() => {
    if (qtyFocused) return;
    setText(formatCartQuantityForLine(line));
  }, [line, qtyFocused]);

  useEffect(() => {
    if (rupeeAmtFocused) return;
    setAmtText(formatInrAmountForInput(lineSubtotal(line)));
  }, [line.quantity, line.unitPrice, line.pricedTotal, rupeeAmtFocused]);

  const atMax = line.stockCap != null && line.quantity >= line.stockCap;

  /** −/+ buttons use draft qty while field is focused so they match typed value. */
  const baseQtyForStepButtons = (): number => {
    if (!qtyFocused) return line.quantity;
    const draft = parseQtyInputString(text);
    if (draft != null && draft > 0) return draft;
    return line.quantity;
  };

  const commit = () => {
    const n = parseQtyInputString(text);
    if (n === null) {
      setText(formatCartQuantityForLine(line));
      return;
    }
    if (n <= 0) {
      setQuantity(line.productId, 0);
      return;
    }
    setQuantity(line.productId, n);
  };

  const commitAmount = () => {
    clearRupeeApplyTimer();
    const rupees = parseInrAmountString(amtText);
    if (rupees === null) {
      setAmtText(formatInrAmountForInput(lineSubtotal(line)));
      return;
    }
    if (rupees <= 0) {
      setQuantity(line.productId, 0);
      return;
    }
    const unit = line.unitPrice;
    if (!Number.isFinite(unit) || unit <= 0) {
      setAmtText(formatInrAmountForInput(lineSubtotal(line)));
      return;
    }
    applyLineRupeeAmount(line.productId, rupees);
  };

  const queueRupeeAmtApplyFromText = (raw: string) => {
    clearRupeeApplyTimer();
    const unit = line.unitPrice;
    if (!Number.isFinite(unit) || unit <= 0) return;
    const rupees = parseInrAmountString(raw);
    if (rupees == null || rupees <= 0) return;
    rupeeApplyTimerRef.current = setTimeout(() => {
      rupeeApplyTimerRef.current = null;
      applyLineRupeeAmount(line.productId, rupees);
    }, 120);
  };

  return (
    <Box sx={{ py: 0.65 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box sx={{ flex: 1, mr: 0.75 }}>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={500} noWrap sx={{ fontSize: "0.72rem", lineHeight: 1.25 }}>
              {line.name}
            </Typography>
            {line.isManual ? (
              <Chip
                label="Manual"
                size="small"
                color="warning"
                variant="outlined"
                sx={{ height: 16, fontSize: "0.5rem", "& .MuiChip-label": { px: 0.4 } }}
              />
            ) : null}
          </Stack>
          {line.stockCap != null && (
            <Typography
              variant="caption"
              color={atMax ? "warning.main" : "text.secondary"}
              sx={{ fontSize: "0.625rem", display: "block" }}
            >
              Stock: {line.stockCap}
            </Typography>
          )}
        </Box>
        <IconButton size="small" onClick={() => removeLine(line.productId)} sx={{ color: "error.main", p: 0.35 }}>
          <DeleteOutlineIcon sx={{ fontSize: "1.1rem" }} />
        </IconButton>
      </Stack>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.35 }}>
        <Stack direction="row" alignItems="center" spacing={0.35}>
          <IconButton
            size="small"
            sx={{ p: 0.35 }}
            onClick={() => {
              clearRupeeApplyTimer();
              const base = normalizeCartQuantity(baseQtyForStepButtons());
              setQtyFocused(false);
              const next = base - 1;
              if (next <= 0) setQuantity(line.productId, 0);
              else setQuantity(line.productId, next);
            }}
          >
            <RemoveIcon sx={{ fontSize: "1.1rem" }} />
          </IconButton>
          <TextField
            size="small"
            type="text"
            inputMode="decimal"
            value={text}
            onFocus={() => {
              clearRupeeApplyTimer();
              setQtyFocused(true);
            }}
            onChange={(e) => {
              clearRupeeApplyTimer();
              const v = e.target.value;
              setText(v);
              const n = parseQtyInputString(v);
              if (n != null && n > 0) {
                setQuantity(line.productId, n);
              }
            }}
            onBlur={() => {
              commit();
              setQtyFocused(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            sx={{ width: 52, "& .MuiInputBase-input": { py: 0.35, fontSize: "0.72rem" } }}
            slotProps={{ htmlInput: { style: { textAlign: "center", padding: "2px 0" } } }}
          />
          <IconButton
            size="small"
            disabled={atMax}
            sx={{ p: 0.35 }}
            onClick={() => {
              clearRupeeApplyTimer();
              const base = normalizeCartQuantity(baseQtyForStepButtons());
              setQtyFocused(false);
              setQuantity(line.productId, base + 1);
            }}
          >
            <AddIcon sx={{ fontSize: "1.1rem" }} />
          </IconButton>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.35, fontSize: "0.625rem" }}>
            × ₹{line.unitPrice.toFixed(2)}
          </Typography>
        </Stack>
        <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.72rem" }}>
          ₹{lineSubtotal(line).toFixed(2)}
        </Typography>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.45 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem", flexShrink: 0 }}>
          By ₹
        </Typography>
        <TextField
          size="small"
          type="text"
          inputMode="decimal"
          placeholder="₹ e.g. 200"
          value={amtText}
          onChange={(e) => {
            const v = e.target.value;
            setAmtText(v);
            queueRupeeAmtApplyFromText(v);
          }}
          onFocus={() => setRupeeAmtFocused(true)}
          onBlur={() => {
            commitAmount();
            setRupeeAmtFocused(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          sx={{
            flex: 1,
            maxWidth: 100,
            "& .MuiInputBase-root": { fontSize: "0.72rem" },
            "& .MuiInputBase-input": { py: 0.45 },
          }}
          slotProps={{
            htmlInput: {
              style: { textAlign: "right" },
              "aria-label": "Target line total in rupees; quantity adjusts to match",
              title:
                "Type rupee amount; quantity updates automatically (shown after a short pause).",
            },
          }}
        />
      </Stack>
    </Box>
  );
}

export function InlineCart({ onOrderPlaced, onNewOrder }: { onOrderPlaced?: () => void; onNewOrder?: () => void }) {
  const queryClient = useQueryClient();
  const notification = useNotification();
  const { outletId } = useOutlet();
  const { lines, setQuantity, applyLineRupeeAmount, removeLine, clear, total } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  /** `false` while idle; otherwise tracks which CTA was clicked so we can label it. */
  const [submitting, setSubmitting] = useState<false | "print" | "new">(false);

  const [discountType, setDiscountType] = useState<"%" | "₹">("₹");
  const [discountInput, setDiscountInput] = useState("");
  const [paymentMode, setPaymentMode] = useState<PosPaymentMode>("Cash");
  const [cashReceived, setCashReceived] = useState("");

  const discountValue = useMemo(() => {
    const v = Number(discountInput);
    if (!Number.isFinite(v) || v < 0) return 0;
    if (discountType === "%") return Math.min(v, 100) / 100 * total;
    return Math.min(v, total);
  }, [discountInput, discountType, total]);

  const finalTotal = useMemo(() => Math.max(total - discountValue, 0), [total, discountValue]);

  const cashReceivedNum = Number(cashReceived) || 0;
  const changeToReturn = paymentMode === "Cash" && cashReceivedNum > finalTotal
    ? cashReceivedNum - finalTotal
    : 0;

  const trimmedCustomerName = customerName.trim();
  const trimmedCustomerPhone = customerPhone.replace(/\D/g, "");
  /** Phone field collects up to 10 digits; Due sales need a reachable number on file. */
  const dueCustomerComplete =
    trimmedCustomerName.length > 0 && trimmedCustomerPhone.length >= 10;

  const [lastOrder, setLastOrder] = useState<InvoiceData | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);
  const lastOrderRef = useRef(lastOrder);
  lastOrderRef.current = lastOrder;

  const handlePrintInvoice = useCallback(() => {
    const d = lastOrderRef.current;
    if (d) void printThermalInvoice(d).catch(console.error);
  }, []);

  const handleNewOrder = useCallback(() => {
    setLastOrder(null);
    setSavedOffline(false);
    setPaymentMode("Cash");
  }, []);

  /** Leaving the success screen via "New Order" or by adding products again. */
  const dismissSuccessScreen = useCallback(() => {
    handleNewOrder();
    onNewOrder?.();
  }, [handleNewOrder, onNewOrder]);

  useEffect(() => {
    if (lines.length === 0 || lastOrder == null) return;
    dismissSuccessScreen();
  }, [lines.length, lastOrder, dismissSuccessScreen]);

  const canPlaceOrder =
    lines.length > 0 &&
    (paymentMode === "Cash" ||
      paymentMode === "Card" ||
      paymentMode === "UPI" ||
      paymentMode === "Due") &&
    (paymentMode !== "Due" || dueCustomerComplete);

  /**
   * `mode === "print"` → save + auto-print receipt + show success screen with reprint.
   * `mode === "new"`   → save only; skip print and skip success screen; go straight to a fresh order.
   */
  const handlePlaceOrder = async (mode: "print" | "new") => {
    if (lines.length === 0) {
      notification.open?.({ type: "error", message: "Cart is empty" });
      return;
    }
    if (!canPlaceOrder) {
      if (paymentMode === "Due" && !dueCustomerComplete) {
        notification.open?.({
          type: "error",
          message: "Customer required",
          description: "Enter name and a 10-digit phone number for credit (Due).",
        });
        return;
      }
      notification.open?.({ type: "error", message: "Cannot place this order." });
      return;
    }

    const invoiceItems = cartLinesToSalePayloadItems(lines);

    const payload = {
      outletId,
      customer: {
        name: trimmedCustomerName || undefined,
        phone: trimmedCustomerPhone || undefined,
        address: customerAddress.trim() || undefined,
      },
      items: invoiceItems,
      subtotal: total,
      discount: discountValue > 0
        ? { type: discountType, value: Number(discountInput) || 0, amount: discountValue }
        : undefined,
      total: finalTotal,
      paymentMode,
    };

    const { date: receiptDate, billTime } = invoiceReceiptStamp();
    const invoiceData: InvoiceData = {
      invoiceNo: "",
      date: receiptDate,
      customerName: trimmedCustomerName || undefined,
      customerPhone: trimmedCustomerPhone || undefined,
      customerAddress: customerAddress.trim() || undefined,
      items: invoiceItems,
      subtotal: total,
      discount: Math.round(discountValue * 100) / 100,
      total: finalTotal,
      paymentMode,
      orderType: "Pick Up",
      billTime,
      cashierName: getSessionCashierName(),
    };

    setSubmitting(mode);
    try {
      // Always enqueue first — guarantees the order is never lost
      const queued = enqueueOrder(payload as Record<string, unknown>, invoiceData);
      invoiceData.invoiceNo = queued.localId;

      let syncedOk = false;
      try {
        const res = await fetch(getSalesCreatePostUrl(), {
          method: "POST",
          headers: getApiHeaders(),
          body: JSON.stringify(payload),
        });
        const body: unknown = await res.json().catch(() => null);

        if (isSalesCreateResponseSuccess(res, body)) {
          const saleId = extractCreatedSaleId(body);
          removeFromQueue(queued.localId);
          invoiceData.invoiceNo = saleId || invoiceData.invoiceNo;
          syncedOk = true;
          await queryClient.invalidateQueries({
            queryKey: keys().data().resource("sales").action("list").get(),
          });
        } else {
          const hint = extractSalesCreateFailureHint(res, body);
          console.error("Order API not accepted:", hint, body);
        }
      } catch (err) {
        console.error("Order create network error — kept in offline queue:", err);
      }

      if (mode === "print") {
        void printThermalInvoice(invoiceData).catch(console.error);
        setLastOrder(invoiceData);
        setSavedOffline(!syncedOk);
      } else {
        // "Save & New Order": no receipt, no success screen — go straight to a fresh cart.
        setLastOrder(null);
        setSavedOffline(false);
        setPaymentMode("Cash");
      }

      clear();
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDiscountInput("");
      setCashReceived("");
      onOrderPlaced?.();
      if (mode === "new") onNewOrder?.();
    } finally {
      setSubmitting(false);
    }
  };

  // ── Order success screen ──
  if (lastOrder) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 1.5, py: 3 }}>
        {savedOffline ? (
          <WifiOffIcon sx={{ fontSize: 48, color: "warning.main" }} />
        ) : (
          <CheckCircleOutlineIcon sx={{ fontSize: 48, color: "success.main" }} />
        )}
        <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.88rem" }}>
          {savedOffline ? "Order Saved Offline" : "Order Placed!"}
        </Typography>
        {savedOffline && (
          <Chip
            icon={<WifiOffIcon />}
            label="Pending sync — will upload when connected"
            color="warning"
            size="small"
            variant="outlined"
          />
        )}
        <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: "0.68rem" }}>
          Invoice: {lastOrder.invoiceNo}
        </Typography>
        {typeof lastOrder.discount === "number" && lastOrder.discount > 0 && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: "0.68rem" }}>
            Discount: −₹{lastOrder.discount.toFixed(2)}
          </Typography>
        )}
        <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.92rem" }}>
          ₹{lastOrder.total.toFixed(2)}
        </Typography>
        {lastOrder.paymentMode && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: "0.68rem" }}>
            Paid via {lastOrder.paymentMode}
          </Typography>
        )}

        <Button
          variant="contained"
          size="small"
          fullWidth
          startIcon={<PrintIcon sx={{ fontSize: "1.1rem" }} />}
          onClick={() => handlePrintInvoice()}
          sx={{ mt: 1.5, py: 0.85, fontWeight: 700, fontSize: "0.72rem" }}
        >
          Print Invoice
        </Button>
        <Button
          variant="outlined"
          size="small"
          fullWidth
          sx={{ fontSize: "0.72rem", py: 0.85 }}
          onClick={dismissSuccessScreen}
        >
          New Order
        </Button>
      </Box>
    );
  }

  // ── Cart view ──
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.85, fontSize: "0.9rem" }}>
        Cart
        {lines.length > 0 && (
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75, fontSize: "0.68rem" }}>
            ({lines.length} {lines.length === 1 ? "item" : "items"})
          </Typography>
        )}
      </Typography>

      {lines.length === 0 ? (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", py: 3 }}>
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ fontSize: "0.72rem" }}>
            Add products to get started.
          </Typography>
        </Box>
      ) : (
        <>
          <Stack
            direction="row"
            spacing={0.85}
            sx={{ flexShrink: 0, mb: 1 }}
          >
            <Button
              variant="contained"
              size="small"
              fullWidth
              disabled={submitting !== false || !canPlaceOrder}
              startIcon={<PrintIcon sx={{ fontSize: "1.05rem" }} />}
              onClick={() => handlePlaceOrder("print")}
              sx={{
                py: 0.85,
                fontWeight: 700,
                fontSize: "0.7rem",
                bgcolor: "#ef6c00",
                "&:hover": { bgcolor: "#e65100" },
              }}
            >
              {submitting === "print" ? "Saving…" : "Save & Print"}
            </Button>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              disabled={submitting !== false || !canPlaceOrder}
              startIcon={<ShoppingCartCheckoutIcon sx={{ fontSize: "1.05rem" }} />}
              onClick={() => handlePlaceOrder("new")}
              sx={{
                py: 0.85,
                fontWeight: 700,
                fontSize: "0.5rem",
                color: "#ef6c00",
                borderColor: "#ef6c00",
                "&:hover": {
                  borderColor: "#e65100",
                  bgcolor: "rgba(239,108,0,0.06)",
                },
              }}
            >
              {submitting === "new" ? "Saving…" : "Save & New Order"}
            </Button>
          </Stack>

          <Box sx={{ flex: 1, overflow: "auto", minHeight: 0, mb: 1 }}>
            <Paper variant="outlined" sx={{ p: 1.15, mb: 1.15 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block" sx={{ fontSize: "0.625rem" }}>
                {paymentMode === "Due" ? "Customer (required for credit)" : "Customer (optional)"}
              </Typography>
              <Stack spacing={0.85}>
                <TextField
                  label="Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  fullWidth
                  size="small"
                  required={paymentMode === "Due"}
                  error={paymentMode === "Due" && trimmedCustomerName.length === 0}
                  helperText={
                    paymentMode === "Due" && trimmedCustomerName.length === 0
                      ? "Required for Due"
                      : undefined
                  }
                  sx={compactInputSx}
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
                  required={paymentMode === "Due"}
                  error={paymentMode === "Due" && trimmedCustomerPhone.length < 10}
                  helperText={
                    paymentMode === "Due" && trimmedCustomerPhone.length < 10
                      ? "Enter 10-digit phone"
                      : undefined
                  }
                  sx={compactInputSx}
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
                  sx={compactInputSx}
                />
              </Stack>
            </Paper>

            {/* Cart items */}
            <Box>
              {lines.map((line, i) => (
                <Box key={line.productId}>
                  <CartLineRow
                    line={line}
                    setQuantity={setQuantity}
                    applyLineRupeeAmount={applyLineRupeeAmount}
                    removeLine={removeLine}
                  />
                  {i < lines.length - 1 && <Divider />}
                </Box>
              ))}
            </Box>

          <Divider sx={{ my: 0.85 }} />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem" }}>
              Subtotal
            </Typography>
            <Typography variant="caption" fontWeight={600} sx={{ fontSize: "0.68rem" }}>
              ₹{total.toFixed(2)}
            </Typography>
          </Stack>

          {/* Discount */}
          <Stack direction="row" alignItems="center" spacing={0.85} sx={{ mt: 0.85 }}>
            <ToggleButtonGroup
              value={discountType}
              exclusive
              onChange={(_, v) => { if (v) setDiscountType(v); }}
              size="small"
              sx={{ height: 28 }}
            >
              <ToggleButton value="₹" sx={{ px: 0.85, fontWeight: 700, fontSize: "0.72rem", py: 0.25 }}>₹</ToggleButton>
              <ToggleButton value="%" sx={{ px: 0.85, fontWeight: 700, fontSize: "0.72rem", py: 0.25 }}>%</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              size="small"
              label={discountType === "%" ? "Discount (%)" : "Discount (₹)"}
              type="number"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              fullWidth
              sx={compactInputSx}
              slotProps={{ htmlInput: { min: 0, max: discountType === "%" ? 100 : total, step: "any" } }}
            />
          </Stack>
          {discountValue > 0 && (
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.35 }}>
              <Typography variant="caption" color="error.main" sx={{ fontSize: "0.68rem" }}>
                {discountType === "%" ? "Discount (%)" : "Discount (₹)"}
              </Typography>
              <Typography variant="caption" color="error.main" fontWeight={600} sx={{ fontSize: "0.68rem" }}>
                −₹{discountValue.toFixed(2)}
              </Typography>
            </Stack>
          )}

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.85, mb: 1.15 }}>
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.8rem" }}>
              Total
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.9rem" }}>
              ₹{finalTotal.toFixed(2)}
            </Typography>
          </Stack>

          {/* Payment Mode */}
          <TextField
            select
            required
            label="Payment Mode"
            value={paymentMode}
            onChange={(e) => {
              setPaymentMode(e.target.value as PosPaymentMode);
              setCashReceived("");
            }}
            fullWidth
            size="small"
            sx={{ mb: 1.15, ...compactInputSx }}
            slotProps={{
              inputLabel: { shrink: true },
              select: {
                displayEmpty: true,
                renderValue: (selected) =>
                  selected === "" ? (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem" }}>
                      Select payment mode
                    </Typography>
                  ) : (
                    String(selected)
                  ),
              },
            }}
          >
            <MenuItem value="Cash">Cash</MenuItem>
            <MenuItem value="Card">Card</MenuItem>
            <MenuItem value="UPI">UPI</MenuItem>
            <MenuItem value="Due">Due (credit)</MenuItem>
          </TextField>

          {/* Cash received & change */}
          {paymentMode === "Cash" && (
            <Paper variant="outlined" sx={{ p: 1.15, mb: 1.15, bgcolor: "grey.50" }}>
              <TextField
                label="Cash Received"
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                fullWidth
                size="small"
                sx={compactInputSx}
                slotProps={{ htmlInput: { min: 0, step: "any" } }}
              />
              {cashReceivedNum > 0 && cashReceivedNum >= finalTotal && (
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.85 }}>
                  <Typography variant="caption" fontWeight={700} color="success.main" sx={{ fontSize: "0.68rem" }}>
                    Return to Customer
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="success.main" sx={{ fontSize: "0.82rem" }}>
                    ₹{changeToReturn.toFixed(2)}
                  </Typography>
                </Stack>
              )}
              {cashReceivedNum > 0 && cashReceivedNum < finalTotal && (
                <Typography variant="caption" color="error" sx={{ mt: 0.35, display: "block", fontSize: "0.68rem" }}>
                  Insufficient — ₹{(finalTotal - cashReceivedNum).toFixed(2)} more needed
                </Typography>
              )}
            </Paper>
          )}

          </Box>
        </>
      )}
    </Box>
  );
}
