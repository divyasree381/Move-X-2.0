import { OpsAnalyticsPage } from "@/components/ops";
import { OpsConsoleShell } from "@/components/shells";

export default function OpsAnalyticsRoute() {
  return <OpsConsoleShell><OpsAnalyticsPage /></OpsConsoleShell>;
}
