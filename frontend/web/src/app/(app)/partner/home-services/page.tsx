"use client";

import { PartnerShell } from "@/components/shells";
import { HomeServiceProfessionalQueue } from "@/components/home-services";

export default function PartnerHomeServicesPage() {
  return <PartnerShell>{({ isOnline }: { isOnline: boolean }) => <HomeServiceProfessionalQueue isOnline={isOnline} />}</PartnerShell>;
}
