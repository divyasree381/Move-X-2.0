export const dynamic = "force-dynamic";

import { OpsPartnersPage } from "@/components/ops";
import { OpsConsoleShell } from "@/components/shells";

export default function OpsPartnersRoute() { return <OpsConsoleShell><OpsPartnersPage /></OpsConsoleShell>; }
