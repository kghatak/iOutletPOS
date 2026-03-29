import { useState } from "react";
import { Navigate } from "react-router";
import { useForm } from "react-hook-form";
import { useIsAuthenticated, useLogin, useNotification } from "@refinedev/core";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

type LoginValues = {
  phoneNumber: string;
  password: string;
};

export const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const notification = useNotification();
  const { data, isPending: authCheckPending } = useIsAuthenticated();
  const { mutate: login, isPending: loginPending } = useLogin<LoginValues>();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    defaultValues: { phoneNumber: "", password: "" },
  });

  const passwordField = register("password", {
    required: "Password is required",
  });

  if (authCheckPending) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (data?.authenticated) {
    return <Navigate to="/products" replace />;
  }

  const busy = loginPending;

  return (
    <Box
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bgcolor="grey.100"
    >
      <Container maxWidth="sm">
        <Card elevation={3}>
          <CardContent sx={{ p: 4 }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ mb: 2 }}
            >
              <Box
                component="img"
                src="/nannu-milk-icon.png"
                alt=""
                sx={{
                  width: 44,
                  height: 44,
                  objectFit: "contain",
                  borderRadius: 1,
                }}
              />
              <Typography variant="h6" component="p" fontWeight={700}>
                Nannu Milk
              </Typography>
            </Stack>
            <Typography variant="h5" component="h1" gutterBottom>
              Outlet sign in
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Use your registered phone number and password.
            </Typography>
            <form
              onSubmit={handleSubmit(
                (values) => {
                  login(values, {
                    onError: (err) => {
                      const msg =
                        err instanceof Error
                          ? err.message
                          : "Sign in failed.";
                      notification.open?.({
                        type: "error",
                        message: msg,
                      });
                    },
                  });
                },
                () => {
                  notification.open?.({
                    type: "error",
                    message: "Check the form fields.",
                  });
                },
              )}
            >
              <Stack spacing={2}>
                <TextField
                  label="Phone number"
                  type="tel"
                  autoComplete="tel"
                  fullWidth
                  disabled={busy}
                  error={!!errors.phoneNumber}
                  helperText={errors.phoneNumber?.message}
                  inputProps={{
                    inputMode: "numeric",
                    maxLength: 10,
                    autoComplete: "tel",
                  }}
                  {...register("phoneNumber", {
                    required: "Phone number is required",
                    setValueAs: (v) =>
                      String(v ?? "")
                        .replace(/\D/g, "")
                        .slice(0, 10),
                    validate: (v) =>
                      v.length === 10 || "Enter exactly 10 digits",
                  })}
                />
                <TextField
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  fullWidth
                  disabled={busy}
                  error={!!errors.password}
                  helperText={errors.password?.message}
                  name={passwordField.name}
                  onBlur={passwordField.onBlur}
                  onChange={passwordField.onChange}
                  inputRef={passwordField.ref}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={
                              showPassword
                                ? "Hide password"
                                : "Show password"
                            }
                            edge="end"
                            onClick={() =>
                              setShowPassword((prev) => !prev)
                            }
                            onMouseDown={(e) => e.preventDefault()}
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <VisibilityOff />
                            ) : (
                              <Visibility />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={busy}
                >
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </Stack>
            </form>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};
