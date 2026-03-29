import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useQueryClient } from "@tanstack/react-query";
import { keys, useNotification } from "@refinedev/core";
import { useCart } from "../../context/cart-context";
import { useOutlet } from "../../context/outlet-context";
import type { CartLine } from "../../types/cart";
import {
  formatCartQuantityForInput,
  lineSubtotal,
  parseQtyInputString,
} from "../../types/cart";
import { API_BASE_URL } from "../../config";
import { getApiHeaders } from "../../providers/authProvider";

function CartQtyField({
  line,
  setQuantity,
}: {
  line: CartLine;
  setQuantity: (productId: string, quantity: number) => void;
}) {
  const [text, setText] = useState(() =>
    formatCartQuantityForInput(line.quantity),
  );

  useEffect(() => {
    setText(formatCartQuantityForInput(line.quantity));
  }, [line.quantity]);

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
      sx={{ width: 96 }}
      slotProps={{
        htmlInput: { style: { textAlign: "center" } },
      }}
    />
  );
}

export const CartPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notification = useNotification();
  const { outletId } = useOutlet();
  const {
    lines,
    setQuantity,
    removeLine,
    clear,
    total,
  } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handlePlaceOrder = async () => {
    if (lines.length === 0) {
      notification.open?.({
        type: "error",
        message: "Cart is empty",
        description: "Add products before placing an order.",
      });
      return;
    }

    const payload = {
      outletId,
      customer: {
        name: customerName.trim() || undefined,
        phone: customerPhone.trim() || undefined,
        address: customerAddress.trim() || undefined,
      },
      items: lines.map((l) => ({
        productId: l.productId,
        name: l.name,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        lineTotal: lineSubtotal(l),
      })),
      total,
    };

    setSubmitting(true);
    try {
      const url = `${API_BASE_URL}/sales`;
      const res = await fetch(url, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        notification.open?.({
          type: "success",
          message: "Order placed",
          description: "The order was submitted successfully.",
        });
        clear();
        setCustomerName("");
        setCustomerPhone("");
        setCustomerAddress("");
        await queryClient.invalidateQueries({
          queryKey: keys().data().resource("sales").action("list").get(),
        });
        navigate("/products");
      } else {
        console.info("Order payload (server returned non-OK):", payload);
        notification.open?.({
          type: "error",
          message: "Order not saved",
          description:
            "The sales API may not be ready. Payload is logged in the console.",
        });
      }
    } catch {
      console.info("Order payload (request failed):", payload);
      notification.open?.({
        type: "error",
        message: "Could not reach server",
        description:
          "Check the console for the payload. Cart is kept so you can retry.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Cart
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Review items, optionally add customer details, then confirm to place the
        sale.
      </Typography>
      <MuiLink
        component={RouterLink}
        to="/products"
        underline="hover"
        sx={{ display: "inline-block", mb: 2 }}
      >
        Add more products
      </MuiLink>

      {lines.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          No items in the cart yet.
        </Typography>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="center" width={140}>
                    Qty
                  </TableCell>
                  <TableCell align="right">Subtotal</TableCell>
                  <TableCell width={56} />
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.productId}>
                    <TableCell>{line.name}</TableCell>
                    <TableCell align="right">
                      ₹{line.unitPrice.toFixed(2)}
                    </TableCell>
                    <TableCell align="center">
                      <CartQtyField line={line} setQuantity={setQuantity} />
                    </TableCell>
                    <TableCell align="right">
                      ₹{lineSubtotal(line).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        aria-label="remove"
                        onClick={() => removeLine(line.productId)}
                        size="small"
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="subtitle1" align="right" gutterBottom>
            Total: <strong>₹{total.toFixed(2)}</strong>
          </Typography>
        </>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Customer (optional)
        </Typography>
        <Stack spacing={2}>
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
            minRows={2}
          />
        </Stack>
      </Paper>

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button
          variant="contained"
          size="large"
          disabled={lines.length === 0 || submitting}
          onClick={handlePlaceOrder}
        >
          {submitting ? "Placing…" : "Confirm & place order"}
        </Button>
      </Stack>
    </Box>
  );
};
