import { AuthLayout } from "@/components/auth/auth-layout";
import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/clients");

  return (
    <AuthLayout
      title="Inregistrare dezactivata"
      description="Contacteaza administratorul pentru acces."
    >
      <div className="text-center">
        <p className="text-sm text-gray mb-6">
          Inregistrarea nu este disponibila in acest moment.
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-primary hover:text-primary-light transition-colors"
        >
          Inapoi la autentificare
        </Link>
      </div>
    </AuthLayout>
  );
}
