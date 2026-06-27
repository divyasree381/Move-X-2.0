import { OpsReconciliationPage } from "@/components/ops";
import { OpsConsoleShell } from "@/components/shells";

export const dynamic = "force-dynamic";

export default function OpsReconciliationRoute() { return <OpsConsoleShell><OpsReconciliationPage /></OpsConsoleShell>; }