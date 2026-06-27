import { OpsDisputesPage } from "@/components/ops";
import { OpsConsoleShell } from "@/components/shells";

export const dynamic = "force-dynamic";

export default function OpsDisputesRoute() { return <OpsConsoleShell><OpsDisputesPage /></OpsConsoleShell>; }