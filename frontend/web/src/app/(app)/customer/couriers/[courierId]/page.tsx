import { CourierDetailPage } from "@/components/couriers";

export default async function CustomerCourierDetailPage({ params }: { params: Promise<{ courierId: string }> }) {
  const { courierId } = await params;

  return <CourierDetailPage courierId={courierId} />;
}
