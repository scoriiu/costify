import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";

interface HomePageProps {
  searchParams: Promise<{ preview?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (user && params.preview !== "1") redirect("/clients");
  return <LandingPage />;
}
