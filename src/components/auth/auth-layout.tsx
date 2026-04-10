import Link from "next/link";
import { Logo } from "@/components/ui/logo";

interface AuthLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-dark px-4 py-16">
      {/* Backdrop ambience — teal glow + subtle grid, matching landing vocabulary */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-[15%] h-[700px] w-[900px] -translate-x-1/2 rounded-full opacity-70"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(13,107,94,0.28) 0%, rgba(13,107,94,0.08) 40%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: "64px 64px",
            color: "var(--text-primary)",
            maskImage:
              "radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)",
          }}
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div
            className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-gray"
          >
            <span className="h-px w-6 bg-gradient-to-r from-transparent to-primary/40" />
            Acces cont
            <span className="h-px w-6 bg-gradient-to-l from-transparent to-primary/40" />
          </div>

          <Link href="/" className="mt-6 inline-block">
            <Logo size="lg" />
          </Link>

          <h1
            className="mt-10 text-[34px] font-bold leading-[1.05] text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            {title}
          </h1>
          <p
            className="mt-3 text-[14px] leading-[1.55] text-gray-light"
            style={{ letterSpacing: "-0.01em" }}
          >
            {description}
          </p>
        </div>

        {/* Form card */}
        <div className="relative mt-7 overflow-hidden rounded-2xl border border-dark-3 bg-dark-2 p-8 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#34D3A0]/60 to-transparent" />
          {children}
        </div>

        {/* Footer meta */}
        <div
          className="mt-8 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-gray"
        >
          <Link
            href="/"
            className="transition-colors hover:text-white"
          >
            ← costify.ro
          </Link>
          <span>cookie httponly · tls 1.3</span>
        </div>
      </div>
    </div>
  );
}
