import { UserRole } from "@movex/shared";

import { PartnerShell } from "@/components/shells";

export default function PartnerRidesPage() {
  return <PartnerShell role={UserRole.DRIVER} />;
}