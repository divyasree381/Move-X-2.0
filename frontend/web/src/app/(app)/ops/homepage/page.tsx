import { OpsHomepagePage } from "@/components/ops";
import { OpsConsoleShell } from "@/components/shells";

export default function OpsHomepageRoute() {
  return <OpsConsoleShell><OpsHomepagePage /></OpsConsoleShell>;
}