export const dynamic = "force-dynamic";

import { OpsRefundsPage } from "@/components/ops";
import { OpsConsoleShell } from "@/components/shells";

export default function OpsRefundsRoute() { return <OpsConsoleShell><OpsRefundsPage /></OpsConsoleShell>; }
