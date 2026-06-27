import { HomeServiceDetailPage } from "@/components/home-services";

export default async function CustomerHomeServiceDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;

  return <HomeServiceDetailPage bookingId={bookingId} />;
}
