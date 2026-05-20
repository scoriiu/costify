import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/modules/auth/session";
import { parseUserRole } from "@/modules/roles";
import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const user = await getSessionUser();
  if (user) {
    const landing = parseUserRole(user.userRole) === "OWNER" ? "/firma" : "/clients";
    redirect(landing);
  }

  const { error } = await searchParams;

  return (
    <AuthLayout
      title="Bine ai revenit"
      description="Autentifica-te in contul Costify"
    >
      <LoginForm error={error} />
    </AuthLayout>
  );
}
