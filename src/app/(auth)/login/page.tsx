import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/clients");

  return (
    <AuthLayout
      title="Bine ai revenit"
      description="Autentifica-te in contul Costify"
    >
      <LoginForm />
    </AuthLayout>
  );
}
