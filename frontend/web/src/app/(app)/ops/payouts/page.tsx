import { OpsConsoleShell } from "@/components/shells";
import { OpsPayoutsPage } from "@/components/ops";

export const dynamic = "force-dynamic";

export default function OpsPayoutsRoute() { return <OpsConsoleShell><OpsPayoutsPage /></OpsConsoleShell>; }
