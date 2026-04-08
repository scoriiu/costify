import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import { User, Mail, Calendar, Shield } from "lucide-react";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl px-8 py-16">
      <h1 className="text-[28px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>Setari</h1>
      <div className="mt-8 rounded-xl border border-dark-3 bg-dark-2 p-6">
        <h2 className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>Profil</h2>
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-3">
            <User size={16} className="text-gray shrink-0" />
            <div>
              <p className="font-mono text-[11px] text-gray uppercase" style={{ letterSpacing: "-0.04em" }}>Nume</p>
              <p className="text-[14px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>{user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail size={16} className="text-gray shrink-0" />
            <div>
              <p className="font-mono text-[11px] text-gray uppercase" style={{ letterSpacing: "-0.04em" }}>Email</p>
              <p className="text-[14px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Shield size={16} className="text-gray shrink-0" />
            <div>
              <p className="font-mono text-[11px] text-gray uppercase" style={{ letterSpacing: "-0.04em" }}>Email verificat</p>
              <p className="text-[14px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>{user.emailVerified ? "Da" : "Nu"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar size={16} className="text-gray shrink-0" />
            <div>
              <p className="font-mono text-[11px] text-gray uppercase" style={{ letterSpacing: "-0.04em" }}>Cont creat</p>
              <p className="text-[14px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>{new Date(user.createdAt).toLocaleDateString("ro-RO", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
