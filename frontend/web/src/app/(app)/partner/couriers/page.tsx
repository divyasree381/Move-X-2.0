"use client";

import { PartnerShell } from "@/components/shells";
import { CourierPartnerQueue } from "@/components/couriers";

export default function PartnerCouriersPage() {
  return <PartnerShell>{({ isOnline }: { isOnline: boolean }) => <CourierPartnerQueue isOnline={isOnline} />}</PartnerShell>;
}
