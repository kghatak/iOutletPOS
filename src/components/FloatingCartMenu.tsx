import { useState, type MouseEvent } from "react";
import { useNavigate } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Fab from "@mui/material/Fab";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { useCart } from "../context/cart-context";
import { formatCartQuantityForInput, lineSubtotal } from "../types/cart";

export function FloatingCartMenu() {
  const navigate = useNavigate();
  const { lines, itemCount, total } = useCart();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const open = Boolean(anchorEl);

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const goToCart = () => {
    handleClose();
    navigate("/cart");
  };

  const countLabel =
    itemCount > 99 ? "99+" : formatCartQuantityForInput(itemCount);

  return (
    <>
      <Box
        sx={{
          position: "fixed",
          bottom: { xs: 20, sm: 28 },
          right: { xs: 20, sm: 28 },
          /* Match FAB layer so the cart popover (modal) can stack above this control. */
          zIndex: (theme) => theme.zIndex.fab,
        }}
      >
        {/* Count pill must stack above the FAB (Fab/ButtonBase creates its own paint order). */}
        <Box
          sx={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Fab
            color="primary"
            size="large"
            aria-label={
              itemCount > 0
                ? `Open cart menu, ${formatCartQuantityForInput(itemCount)} items`
                : "Open cart menu"
            }
            aria-haspopup="true"
            aria-expanded={open}
            onClick={handleOpen}
            sx={{
              boxShadow: 6,
              position: "relative",
              zIndex: 0,
            }}
          >
            <ShoppingCartIcon />
          </Fab>
          {itemCount > 0 ? (
            <Box
              component="span"
              aria-hidden
              sx={{
                position: "absolute",
                top: 4,
                right: 4,
                zIndex: (theme) => theme.zIndex.fab + 1,
                minWidth: 22,
                height: 22,
                px: itemCount >= 10 || String(countLabel).includes(".") ? 0.5 : 0,
                borderRadius: "11px",
                bgcolor: "error.main",
                color: "error.contrastText",
                fontSize: "0.75rem",
                fontWeight: 700,
                lineHeight: "22px",
                textAlign: "center",
                boxShadow: 2,
                pointerEvents: "none",
              }}
            >
              {countLabel}
            </Box>
          ) : null}
        </Box>
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        slotProps={{
          paper: {
            elevation: 8,
            sx: {
              width: 340,
              maxWidth: "calc(100vw - 40px)",
              mb: 1.5,
              borderRadius: 2,
            },
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Your cart
          </Typography>

          {lines.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No items yet. Tap Add on a product to start your order.
            </Typography>
          ) : (
            <>
              <List dense disablePadding sx={{ maxHeight: 260, overflow: "auto" }}>
                {lines.map((line) => (
                  <ListItem key={line.productId} disableGutters sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={
                        <Typography variant="body2" noWrap fontWeight={500}>
                          {line.name}
                        </Typography>
                      }
                      secondary={`${formatCartQuantityForInput(line.quantity)} × ₹${line.unitPrice.toFixed(2)}`}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ flexShrink: 0, ml: 1 }}
                    >
                      ₹{lineSubtotal(line).toFixed(2)}
                    </Typography>
                  </ListItem>
                ))}
              </List>
              <Divider sx={{ my: 1.5 }} />
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Total
                </Typography>
                <Typography variant="subtitle1" fontWeight={700}>
                  ₹{total.toFixed(2)}
                </Typography>
              </Stack>
            </>
          )}

          <Button variant="contained" fullWidth size="medium" onClick={goToCart}>
            {lines.length === 0 ? "Go to cart" : "Review & order"}
          </Button>
        </Box>
      </Popover>
    </>
  );
}
