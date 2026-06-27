import { RideDetailPage } from "@/components/rides";
import { CustomerShell } from "@/components/shells";

export default async function CustomerRideDetailPage({ params }: { params: Promise<{ rideId: string }> }) {
  const { rideId } = await params;

  return (
    <CustomerShell>
      <RideDetailPage rideId={rideId} />
    </CustomerShell>
  );
}