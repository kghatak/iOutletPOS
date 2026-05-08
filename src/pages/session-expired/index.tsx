import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";

export const SessionExpiredPage = () => {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          navigate("/login", { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [navigate]);

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
            <Stack spacing={1.5} alignItems="center" textAlign="center">
              <Typography variant="h5" component="h1" fontWeight={700}>
                Session Expired
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Your session has expired. Please sign in again.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Redirecting to login in <strong>{secondsLeft}</strong> second
                {secondsLeft === 1 ? "" : "s"}...
              </Typography>
              <Box sx={{ pt: 1 }}>
                <Button
                  variant="contained"
                  onClick={() => navigate("/login", { replace: true })}
                >
                  Go to Login Now
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};
