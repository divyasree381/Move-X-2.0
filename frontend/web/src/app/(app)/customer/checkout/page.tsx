import { CheckoutPage } from "@/components/orders";
import { CustomerShell } from "@/components/shells";

export default function CustomerCheckoutRoute() {
  return (
    <CustomerShell>
      <CheckoutPage />
    </CustomerShell>
  );
}