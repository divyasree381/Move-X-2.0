export const dynamic = "force-dynamic";

import { OpsUsersPage } from "@/components/ops";
import { OpsConsoleShell } from "@/components/shells";

export default function OpsUsersRoute() { return <OpsConsoleShell><OpsUsersPage /></OpsConsoleShell>; }
