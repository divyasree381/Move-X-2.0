import { StoreDetailPage } from "@/components/marketplace";
import { CustomerShell } from "@/components/shells";

export default async function CustomerStorePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;

  return (
    <CustomerShell>
      <StoreDetailPage storeId={storeId} />
    </CustomerShell>
  );
}