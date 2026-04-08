import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

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
  title: "Costify — Financial Control Platform",
  description:
    "Multi-tenant financial control for accountants and finance managers",
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
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{if(localStorage.getItem("costify-theme")==="dark")document.documentElement.classList.remove("light")}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
