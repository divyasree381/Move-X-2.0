import { CourierBookingPage } from "@/components/couriers";
import { CustomerShell } from "@/components/shells";

export default function CustomerCouriersPage() {
  return (
    <CustomerShell mode="focused">
      <CourierBookingPage />
    </CustomerShell>
  );
}
