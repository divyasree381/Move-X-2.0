import { OrderHistoryPage } from "@/components/orders";
import { CustomerShell } from "@/components/shells";

export default function CustomerOrdersRoute() {
  return (
    <CustomerShell>
      <OrderHistoryPage />
    </CustomerShell>
  );
}