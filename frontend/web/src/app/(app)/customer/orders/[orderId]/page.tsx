import { OrderDetailPage } from "@/components/orders";
import { CustomerShell } from "@/components/shells";

export default async function CustomerOrderDetailRoute({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  return (
    <CustomerShell>
      <OrderDetailPage orderId={orderId} />
    </CustomerShell>
  );
}