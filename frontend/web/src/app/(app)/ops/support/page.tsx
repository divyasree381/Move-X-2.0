export const dynamic = "force-dynamic";

import { OpsSupportPage } from "@/components/ops";
import { OpsConsoleShell } from "@/components/shells";

export default function OpsSupportRoute() { return <OpsConsoleShell><OpsSupportPage /></OpsConsoleShell>; }
