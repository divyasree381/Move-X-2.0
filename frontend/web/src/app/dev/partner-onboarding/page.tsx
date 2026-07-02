import { PartnerOnboardingPage } from "@/components/partner";
import { getPartnerLoginConfig, isPartnerLoginType, type PartnerLoginType } from "@/lib/auth-flow";
import type { AuthUser } from "@/lib/api";

type DevPartnerOnboardingPageProps = {
  searchParams: Promise<{ type?: string }>;
};

export default async function DevPartnerOnboardingPage({ searchParams }: DevPartnerOnboardingPageProps) {
  const params = await searchParams;
  const partnerType: PartnerLoginType = isPartnerLoginType(params.type) ? params.type : "store-partner";
  const partner = getPartnerLoginConfig(partnerType);
  const previewUser: AuthUser = {
    id: "dev-partner-preview",
    role: partner.backendRole,
    phoneE164: "+919876543210",
    name: `${partner.label} Preview`,
    avatarUrl: null,
    partnerApproval: "NONE",
    isBanned: false,
    isOnline: false,
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
  };

  return <PartnerOnboardingPage preview={{ user: previewUser, partnerType }} />;
}