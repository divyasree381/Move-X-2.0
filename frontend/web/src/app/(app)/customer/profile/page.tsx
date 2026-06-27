import { CustomerRetentionPanel } from "@/components/retention";
import { CustomerShell } from "@/components/shells";

export default function CustomerProfilePage() {
  return (
    <CustomerShell>
      <CustomerRetentionPanel />
    </CustomerShell>
  );
}