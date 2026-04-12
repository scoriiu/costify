import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import Script from "next/script";
import { SITE_URL, SITE_NAME, SITE_LOCALE, SITE_DESCRIPTION, SITE_KEYWORDS } from "@/lib/seo";
import "./globals.css";

const UMAMI_WEBSITE_ID = "c8b9ebd3-637a-44b3-a078-1f7cdef16644";

const themeInitScript = `try{if(localStorage.getItem("costify-theme")==="dark")document.documentElement.classList.remove("light")}catch(e){}`;

const altform = localFont({
  src: [
    { path: "../../public/fonts/altform-regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/altform-semibold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/altform-bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-altform",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} · Control financiar pentru contabili romani`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [...SITE_KEYWORDS],
  authors: [{ name: "Nisindo", url: "https://nisindo.com" }],
  creator: "Nisindo",
  publisher: "Nisindo",
  applicationName: SITE_NAME,
  generator: "Next.js",
  referrer: "strict-origin-when-cross-origin",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: SITE_LOCALE,
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} · Control financiar pentru contabili romani`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — control financiar pentru contabili romani`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} · Control financiar pentru contabili romani`,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "business",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F0EFEA" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1514" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      className={`${altform.variable} ${geistMono.variable} h-full antialiased light`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        {process.env.NODE_ENV === "production" && (
          <Script
            src="https://analytics.costify.ro/script.js"
            data-website-id={UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
