import { renderFirmaPlaceholder } from "../_lib/placeholder-page";

interface Props {
  searchParams: Promise<{ as?: string; firm?: string }>;
}

export default async function FirmaVenituriPage(props: Props) {
  const { as, firm } = await props.searchParams;
  return renderFirmaPlaceholder("venituri", { asClientId: as ?? null, firmSlug: firm ?? null });
}
