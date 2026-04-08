import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";

export default async function ReportsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl px-8 py-16">
      <h1 className="text-[28px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>Rapoarte</h1>
      <p className="mt-2 text-[14px] text-gray">In curand.</p>
    </div>
  );
}
