import { destroySessionAction } from "./logout-action";
import type { ResolvedSessionUser } from "./resolve-client";

interface Props {
  user: ResolvedSessionUser;
}

export function NoAccessScreen({ user }: Props) {
  return (
    <main className="min-h-screen bg-dark text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <h1
          className="text-[28px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Nicio firma asociata
        </h1>
        <p
          className="mt-3 text-[14px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          Contul tau ({user.email}) nu are inca acces la nicio firma. Cere
          contabilului sa-ti dea acces din contul lui.
        </p>
        <form action={destroySessionAction} className="mt-8">
          <button
            type="submit"
            className="text-[13px] font-medium text-gray-light hover:text-primary-light transition-colors underline underline-offset-2"
            style={{ letterSpacing: "-0.02em" }}
          >
            Iesi din cont
          </button>
        </form>
      </div>
    </main>
  );
}
