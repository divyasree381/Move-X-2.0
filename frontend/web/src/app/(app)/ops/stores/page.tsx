export const dynamic = "force-dynamic";

import { OpsStoresPage } from "@/components/ops";
import { OpsConsoleShell } from "@/components/shells";

export default function OpsStoresRoute() { return <OpsConsoleShell><OpsStoresPage /></OpsConsoleShell>; }
