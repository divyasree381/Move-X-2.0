export const dynamic = "force-dynamic";

import { OpsConfigPage } from "@/components/ops";
import { OpsConsoleShell } from "@/components/shells";

export default function OpsConfigRoute() { return <OpsConsoleShell><OpsConfigPage /></OpsConsoleShell>; }
