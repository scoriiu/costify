import { renderFirmaPlaceholder } from "../_lib/placeholder-page";

interface Props {
  searchParams: Promise<{ as?: string; firm?: string }>;
}

export default async function FirmaSanatatePage(props: Props) {
  const { as, firm } = await props.searchParams;
  return renderFirmaPlaceholder("sanatate", { asClientId: as ?? null, firmSlug: firm ?? null });
}
