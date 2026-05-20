import { renderFirmaPlaceholder } from "../_lib/placeholder-page";

interface Props {
  searchParams: Promise<{ as?: string; firm?: string }>;
}

export default async function FirmaEuPage(props: Props) {
  const { as, firm } = await props.searchParams;
  return renderFirmaPlaceholder("eu", { asClientId: as ?? null, firmSlug: firm ?? null });
}
