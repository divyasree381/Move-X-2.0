import { CustomerAccountPage } from "@/components/profile";
import { CustomerShell } from "@/components/shells";

export default function CustomerProfilePage() {
  return (
    <CustomerShell>
      <CustomerAccountPage />
    </CustomerShell>
  );
}