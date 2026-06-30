import { notFound } from "next/navigation";

import { PartnerOtpLoginPage } from "@/components/auth/login-page";
import { getPartnerLoginConfig, isPartnerLoginType, partnerLoginTypes } from "@/lib/auth-flow";

export function generateStaticParams() {
  return partnerLoginTypes.map((partnerType) => ({ partnerType }));
}

export default async function PartnerOtpLoginRoute({ params }: { params: Promise<{ partnerType: string }> }) {
  const { partnerType } = await params;

  if (!isPartnerLoginType(partnerType)) {
    notFound();
  }

  return <PartnerOtpLoginPage partner={getPartnerLoginConfig(partnerType)} />;
}
