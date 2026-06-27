import { OpsConsoleShell } from "@/components/shells";
import { OpsInvoicesPage } from "@/components/ops";

export const dynamic = "force-dynamic";

export default function OpsInvoicesRoute() { return <OpsConsoleShell><OpsInvoicesPage /></OpsConsoleShell>; }
