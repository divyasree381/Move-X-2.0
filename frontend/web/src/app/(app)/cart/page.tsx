import { CartPage } from "@/components/orders";
import { CustomerShell } from "@/components/shells";

export default function CartRoute() {
  return (
    <CustomerShell>
      <CartPage />
    </CustomerShell>
  );
}
