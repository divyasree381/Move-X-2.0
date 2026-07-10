import { RideBookingPage } from "@/components/rides";
import { CustomerShell } from "@/components/shells";

export default function CustomerRidesPage() {
  return (
    <CustomerShell mode="focused">
      <RideBookingPage />
    </CustomerShell>
  );
}