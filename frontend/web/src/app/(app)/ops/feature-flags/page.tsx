import { OpsFeatureFlagsPage } from "@/components/ops";
import { OpsConsoleShell } from "@/components/shells";

export default function OpsFeatureFlagsRoute() {
  return <OpsConsoleShell><OpsFeatureFlagsPage /></OpsConsoleShell>;
}
