import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Palette, Megaphone, Smile } from "lucide-react";

const INTERNAL_WHITELIST = [
  "solomon.coriiu@costify.ro",
  "claudia.solomon@costify.ro",
  "sorin.crisan@costify.ro",
];

const ITEMS = [
  { href: "/design", icon: Palette, label: "Design System", desc: "Culori, tipografie, componente, palette" },
  { href: "/marketing", icon: Megaphone, label: "Marketing", desc: "Strategie, target audience, GTM, pricing" },
  { href: "/debug", icon: Smile, label: "Mascot", desc: "Costi — toate starile si expresiile" },
];

export default async function InternalPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!INTERNAL_WHITELIST.includes(user.email)) redirect("/clients");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-16">
      <h1 className="text-[28px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>Internal</h1>
      <p className="mt-2 text-[14px] text-gray" style={{ letterSpacing: "-0.02em" }}>Resurse interne — vizibile doar pentru echipa.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-xl border border-dark-3 bg-dark-2 p-5 transition-all hover:border-primary/20 hover:-translate-y-0.5"
          >
            <item.icon size={20} className="text-gray mb-3 group-hover:text-primary transition-colors" />
            <p className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>{item.label}</p>
            <p className="mt-1 text-[13px] text-gray" style={{ letterSpacing: "-0.02em" }}>{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
