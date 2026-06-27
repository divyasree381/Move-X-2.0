export const dynamic = "force-dynamic";

import { OpsTicketDetailPage } from "@/components/ops";
import { OpsConsoleShell } from "@/components/shells";

export default async function OpsTicketDetailRoute({ params }: { params: Promise<{ ticketId: string }> }) { const { ticketId } = await params; return <OpsConsoleShell><OpsTicketDetailPage ticketId={ticketId} /></OpsConsoleShell>; }
