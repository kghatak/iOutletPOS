import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { featureForPosPath, firstPosPath } from "./tenantFeatures";

export function FeatureGuard({
  features,
  children,
}: {
  features: string[] | null;
  children: ReactNode;
}) {
  const location = useLocation();
  if (!features) return <>{children}</>;

  const required = featureForPosPath(location.pathname);
  if (!required || features.includes(required)) return <>{children}</>;

  const next = firstPosPath(features);
  if (next && next !== location.pathname) return <Navigate to={next} replace />;

  return (
    <Box sx={{ p: 3 }}>
      <Typography>
        No features are enabled for this tenant. A super admin can turn them on from the tenant page.
      </Typography>
    </Box>
  );
}
