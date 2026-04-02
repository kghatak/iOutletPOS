import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import ShoppingCartCheckoutIcon from "@mui/icons-material/ShoppingCartCheckout";
import PrintIcon from "@mui/icons-material/Print";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useQueryClient } from "@tanstack/react-query";
import { keys, useNotification } from "@refinedev/core";
import { useCart } from "../context/cart-context";
import { useOutlet } from "../context/outlet-context";
import type { CartLine } from "../types/cart";
import {
  formatCartQuantityForInput,
  lineSubtotal,
  parseQtyInputString,
} from "../types/cart";
import { API_BASE_URL } from "../config";
import { getApiHeaders } from "../providers/authProvider";
import { printThermalInvoice, type InvoiceData } from "../utils/thermalInvoice";

function CartLineRow({
  line,
  setQuantity,
  removeLine,
}: {
  line: CartLine;
  setQuantity: (productId: string, quantity: number) => void;
  removeLine: (productId: string) => void;
}) {
  const [text, setText] = useState(() =>
    formatCartQuantityForInput(line.quantity),
  );

  useEffect(() => {
    setText(formatCartQuantityForInput(line.quantity));
  }, [line.quantity]);

  const atMax = line.stockCap != null && line.quantity >= line.stockCap;

  const commit = () => {
    const n = parseQtyInputString(text);
    if (n === null) {
      setText(formatCartQuantityForInput(line.quantity));
      return;
    }
    if (n <= 0) {
      setQuantity(line.productId, 0);
      return;
    }
    setQuantity(line.productId, n);
  };

  return (
    <Box sx={{ py: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box sx={{ flex: 1, mr: 1 }}>
          <Typography variant="body2" fontWeight={500} noWrap>
            {line.name}
          </Typography>
          {line.stockCap != null && (
            <Typography variant="caption" color={atMax ? "warning.main" : "text.secondary"}>
              Stock: {line.stockCap}
            </Typography>
          )}
        </Box>
        <IconButton size="small" onClick={() => removeLine(line.productId)} sx={{ color: "error.main" }}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.5 }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <IconButton
            size="small"
            onClick={() => {
              const next = line.quantity - 1;
              if (next <= 0) setQuantity(line.productId, 0);
              else setQuantity(line.productId, next);
            }}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
          <TextField
            size="small"
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            sx={{ width: 60 }}
            slotProps={{ htmlInput: { style: { textAlign: "center", padding: "4px 0" } } }}
          />
          <IconButton size="small" disabled={atMax} onClick={() => setQuantity(line.productId, line.quantity + 1)}>
            <AddIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            × ₹{line.unitPrice.toFixed(2)}
          </Typography>
        </Stack>
        <Typography variant="body2" fontWeight={600}>
          ₹{lineSubtotal(line).toFixed(2)}
        </Typography>
      </Stack>
    </Box>
  );
}

function formatInvoiceDate(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function InlineCart({ onOrderPlaced, onNewOrder }: { onOrderPlaced?: () => void; onNewOrder?: () => void }) {
  const queryClient = useQueryClient();
  const notification = useNotification();
  const { outletId } = useOutlet();
  const { lines, setQuantity, removeLine, clear, total } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [lastOrder, setLastOrder] = useState<InvoiceData | null>(null);
  const lastOrderRef = useRef(lastOrder);
  lastOrderRef.current = lastOrder;

  const handlePrintInvoice = useCallback(() => {
    if (lastOrderRef.current) printThermalInvoice(lastOrderRef.current);
  }, []);

  const handleNewOrder = useCallback(() => {
    setLastOrder(null);
  }, []);

  const handlePlaceOrder = async () => {
    if (lines.length === 0) {
      notification.open?.({ type: "error", message: "Cart is empty" });
      return;
    }

    const invoiceItems = lines.map((l) => ({
      productId: l.productId,
      name: l.name,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      lineTotal: lineSubtotal(l),
    }));

    const payload = {
      outletId,
      customer: {
        name: customerName.trim() || undefined,
        phone: customerPhone.trim() || undefined,
        address: customerAddress.trim() || undefined,
      },
      items: invoiceItems,
      total,
    };

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/sales`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);

      if (res.ok && body?.success !== false) {
        const saleId = body?.data?.saleId ?? body?.data?.id ?? body?.saleId ?? body?.id ?? "";

        const invoiceData: InvoiceData = {
          invoiceNo: saleId ? String(saleId) : `ORD-${Date.now()}`,
          date: formatInvoiceDate(),
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          customerAddress: customerAddress.trim() || undefined,
          items: invoiceItems,
          total,
        };

        setLastOrder(invoiceData);
        clear();
        setCustomerName("");
        setCustomerPhone("");
        setCustomerAddress("");
        onOrderPlaced?.();

        notification.open?.({
          type: "success",
          message: "Order placed!",
          description: "You can now print the invoice.",
        });
        await queryClient.invalidateQueries({
          queryKey: keys().data().resource("sales").action("list").get(),
        });
      } else {
        const serverMsg = body?.message || `Server returned ${res.status}`;
        console.error("Order failed:", serverMsg, "Payload:", payload);
        notification.open?.({
          type: "error",
          message: "Order not saved",
          description: serverMsg,
        });
      }
    } catch {
      console.info("Order payload (request failed):", payload);
      notification.open?.({
        type: "error",
        message: "Could not reach server",
        description: "Check the console for the payload. Cart is kept so you can retry.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Order success screen ──
  if (lastOrder) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 2, py: 4 }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 64, color: "success.main" }} />
        <Typography variant="h6" fontWeight={700}>
          Order Placed!
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Invoice: {lastOrder.invoiceNo}
        </Typography>
        <Typography variant="h6" fontWeight={700}>
          ₹{lastOrder.total.toFixed(2)}
        </Typography>

        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<PrintIcon />}
          onClick={handlePrintInvoice}
          sx={{ mt: 2, py: 1.5, fontWeight: 700 }}
        >
          Print Invoice
        </Button>
        <Button
          variant="outlined"
          size="large"
          fullWidth
          onClick={() => {
            handleNewOrder();
            onNewOrder?.();
          }}
        >
          New Order
        </Button>
      </Box>
    );
  }

  // ── Cart view ──
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
        Cart
        {lines.length > 0 && (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            ({lines.length} {lines.length === 1 ? "item" : "items"})
          </Typography>
        )}
      </Typography>

      {lines.length === 0 ? (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", py: 4 }}>
          <Typography color="text.secondary" textAlign="center">
            Add products to get started.
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ flex: 1, overflow: "auto", mb: 1 }}>
            {lines.map((line, i) => (
              <Box key={line.productId}>
                <CartLineRow line={line} setQuantity={setQuantity} removeLine={removeLine} />
                {i < lines.length - 1 && <Divider />}
              </Box>
            ))}
          </Box>

          <Divider sx={{ my: 1 }} />
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Total
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              ₹{total.toFixed(2)}
            </Typography>
          </Stack>

          <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
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
                onChange={(e) => setCustomerPhone(e.target.value)}
                fullWidth
                size="small"
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

          <Button
            variant="contained"
            fullWidth
            size="large"
            disabled={submitting}
            startIcon={<ShoppingCartCheckoutIcon />}
            onClick={handlePlaceOrder}
            sx={{ py: 1.5, fontWeight: 700, fontSize: "1rem" }}
          >
            {submitting ? "Placing order…" : "Confirm & Place Order"}
          </Button>
        </>
      )}
    </Box>
  );
}
