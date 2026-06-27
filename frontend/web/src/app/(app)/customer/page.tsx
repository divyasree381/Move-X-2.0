import { CustomerDiscovery } from "@/components/marketplace";
import { CustomerShell } from "@/components/shells";

export default function CustomerPage() {
  return (
    <CustomerShell>
      <CustomerDiscovery />
    </CustomerShell>
  );
}