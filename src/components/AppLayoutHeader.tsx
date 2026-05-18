import type { FC } from "react";
import { useGetIdentity } from "@refinedev/core";
import {
  HamburgerMenu,
  type RefineThemedLayoutHeaderProps,
} from "@refinedev/mui";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";
import { Link as RouterLink } from "react-router";

export const AppLayoutHeader: FC<RefineThemedLayoutHeaderProps> = ({ sticky }) => {
  const { data: user } = useGetIdentity();
  const preferSticky = sticky ?? true;

  return (
    <AppBar position={preferSticky ? "sticky" : "relative"}>
      <Toolbar>
        <HamburgerMenu />
        <Button
          component={RouterLink}
          to="/products"
          variant="contained"
          color="inherit"
          size="small"
          startIcon={<AddShoppingCartOutlinedIcon />}
          sx={{
            ml: 0.5,
            mr: 1,
            fontWeight: 600,
            border: 1,
            borderColor: "rgba(255,255,255,0.35)",
            bgcolor: "rgba(255,255,255,0.12)",
            "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
          }}
        >
          New Order
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Stack direction="row" gap={2} alignItems="center" justifyContent="center">
          {user?.name ? <Typography variant="subtitle2">{user.name}</Typography> : null}
          {user?.avatar ? <Avatar src={user.avatar} alt={user.name} /> : null}
        </Stack>
      </Toolbar>
    </AppBar>
  );
};
