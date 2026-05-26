interface Props {
  clientName: string;
}

/**
 * Shown to an OWNER (or accountant preview) when the client has zero
 * PublishedPeriod rows. Different from "no-access" — here the user is
 * authorized; the accountant simply hasn't published anything yet.
 */
export function NothingPublishedScreen({ clientName }: Props) {
  return (
    <div className="rounded-xl border border-dashed border-dark-3 bg-dark-2/50 p-8 sm:p-12">
      <h1
        className="text-[24px] font-semibold text-white"
        style={{ letterSpacing: "-0.04em" }}
      >
        Asteapta sa-ti publice contabilul prima luna
      </h1>
      <p
        className="mt-3 max-w-xl text-[14px] text-gray-light"
        style={{ letterSpacing: "-0.02em" }}
      >
        Contabilul tau lucreaza la datele firmei {clientName}. Imediat ce
        publica prima luna, vei vedea aici cum sta firma — bani, clienti, profit
        si tot ce conteaza. Te anuntam cand e gata.
      </p>
    </div>
  );
}
