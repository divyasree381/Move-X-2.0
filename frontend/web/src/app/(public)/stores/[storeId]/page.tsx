import { notFound } from "next/navigation";

import { PublicStoreDetailPage } from "@/components/public/public-site";
import { findPublicStore, publicStores } from "@/lib/public-site-data";

export function generateStaticParams() {
  return publicStores.map((store) => ({ storeId: store.id }));
}

export default async function PublicStoreRoute({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;

  if (!findPublicStore(storeId)) {
    notFound();
  }

  return <PublicStoreDetailPage storeId={storeId} />;
}
