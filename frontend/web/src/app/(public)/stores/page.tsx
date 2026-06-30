import { PublicStoresPage, resolvePublicStoreType } from "@/components/public/public-site";

type StoresSearchParams = {
  type?: string | string[];
};

export default async function StoresRoute({ searchParams }: { searchParams: Promise<StoresSearchParams> }) {
  const params = await searchParams;
  const typeParam = Array.isArray(params.type) ? params.type[0] : params.type;

  return <PublicStoresPage selectedType={resolvePublicStoreType(typeParam)} />;
}
