export const dynamic = "force-dynamic";

import { OpsAuditPage } from "@/components/ops";
import { OpsConsoleShell } from "@/components/shells";

export default function OpsAuditRoute() { return <OpsConsoleShell><OpsAuditPage /></OpsConsoleShell>; }
