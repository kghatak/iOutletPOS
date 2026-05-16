import { useState } from "react";
import { useLogout } from "@refinedev/core";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import LogoutIcon from "@mui/icons-material/Logout";

type Props = {
  collapsed: boolean;
};

export function SiderLogoutButton({ collapsed }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { mutate: logoutMutate, isPending } = useLogout();

  const listButton = (
    <ListItemButton
      dense
      onClick={() => setConfirmOpen(true)}
      sx={{ borderRadius: 1 }}
      aria-haspopup="dialog"
    >
      <ListItemIcon
        sx={{ minWidth: collapsed ? 0 : undefined, justifyContent: "center", mr: collapsed ? 0 : 2 }}
      >
        <LogoutIcon />
      </ListItemIcon>
      {!collapsed ? <ListItemText primaryTypographyProps={{ variant: "body2" }} primary="Logout" /> : null}
    </ListItemButton>
  );

  const handleLogout = () => {
    logoutMutate();
    setConfirmOpen(false);
  };

  return (
    <>
      <ListItem disablePadding>
        {collapsed ? (
          <Tooltip title="Logout" placement="right" arrow enterDelay={200}>
            {listButton}
          </Tooltip>
        ) : (
          listButton
        )}
      </ListItem>

      <Dialog
        open={confirmOpen}
        onClose={() => !isPending && setConfirmOpen(false)}
        aria-labelledby="logout-dialog-title"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="logout-dialog-title">Log out?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            You will need to sign in again to use the app.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="contained" color="primary" onClick={handleLogout} disabled={isPending}>
            {isPending ? "Logging out…" : "Log out"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
