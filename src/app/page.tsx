import type { Metadata } from "next";
import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";

export const metadata: Metadata = {
  title: `${SITE_NAME} · Control financiar pentru contabili romani`,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

interface HomePageProps {
  searchParams: Promise<{ preview?: string }>;
}

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  description: SITE_DESCRIPTION,
  foundingDate: "2026",
  foundingLocation: {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressCountry: "RO",
    },
  },
  areaServed: {
    "@type": "Country",
    name: "Romania",
  },
  knowsLanguage: ["ro", "en"],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    availableLanguage: ["Romanian", "English"],
    url: `${SITE_URL}/login`,
  },
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  operatingSystem: "Web",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "AccountingSoftware",
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  inLanguage: "ro",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
    description: "Acces prin invitatie pe perioada preview-ului",
  },
  featureList: [
    "Import jurnal Saga, SmartBill, Ciel",
    "Balanta de verificare in timp real",
    "Cont Profit si Pierdere calculat live",
    "KPI financiari (cash, creante, datorii, TVA, rezultat, marja)",
    "Audit trail inviolabil",
    "Costi AI - asistent contabilitate romaneasca",
    "Plan de conturi OMFP 1802",
  ],
  aggregateRating: undefined,
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (user && params.preview !== "1") redirect("/clients");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationSchema),
        }}
      />
      <LandingPage />
    </>
  );
}
