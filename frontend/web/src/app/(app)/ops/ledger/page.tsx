import { OpsConsoleShell } from "@/components/shells";
import { OpsLedgerPage } from "@/components/ops";

export const dynamic = "force-dynamic";

export default function OpsLedgerRoute() { return <OpsConsoleShell><OpsLedgerPage /></OpsConsoleShell>; }
