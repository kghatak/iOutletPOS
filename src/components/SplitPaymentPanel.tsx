import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";
import {
  buildPaymentsFromSplitAmounts,
  isSplitPaymentBalanced,
  SPLIT_PAYMENT_CHANNELS,
  splitPaymentsTotal,
  type SplitPaymentAmounts,
} from "../types/payment";

type SplitPaymentPanelProps = {
  finalTotal: number;
  amounts: SplitPaymentAmounts;
  onChange: (mode: keyof SplitPaymentAmounts, value: string) => void;
  fieldSx?: SxProps<Theme>;
};

export function SplitPaymentPanel({
  finalTotal,
  amounts,
  onChange,
  fieldSx,
}: SplitPaymentPanelProps) {
  const payments = buildPaymentsFromSplitAmounts(amounts);
  const paid = splitPaymentsTotal(payments);
  const remaining = Math.round((finalTotal - paid) * 100) / 100;
  const balanced = isSplitPaymentBalanced(payments, finalTotal);

  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "grey.50" }}>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        Enter amounts per mode (must total ₹{finalTotal.toFixed(2)})
      </Typography>
      <Stack spacing={1}>
        {SPLIT_PAYMENT_CHANNELS.map((mode) => (
          <TextField
            key={mode}
            label={`${mode} (₹)`}
            type="number"
            value={amounts[mode]}
            onChange={(e) => onChange(mode, e.target.value)}
            fullWidth
            size="small"
            sx={fieldSx}
            slotProps={{ htmlInput: { min: 0, step: "any" } }}
          />
        ))}
      </Stack>
      <Stack spacing={0.5} sx={{ mt: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption">Paid</Typography>
          <Typography variant="caption" fontWeight={600}>
            ₹{paid.toFixed(2)}
          </Typography>
        </Stack>
        {!balanced && paid > 0 && (
          <Typography
            variant="caption"
            color={remaining > 0 ? "error" : "warning.main"}
          >
            {remaining > 0
              ? `₹${remaining.toFixed(2)} more needed`
              : `₹${Math.abs(remaining).toFixed(2)} over total`}
          </Typography>
        )}
        {balanced && (
          <Typography variant="caption" color="success.main" fontWeight={600}>
            Split payment matches total ✓
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
