import { Logo } from "@/components/ui/logo";

interface AuthLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-[10%] -left-[5%] h-[500px] w-[500px] rounded-full bg-primary/[0.07] blur-[100px]" />
        <div className="absolute -bottom-[10%] -right-[5%] h-[400px] w-[400px] rounded-full bg-accent/[0.05] blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="mt-2 text-sm text-gray">{description}</p>
        </div>

        <div className="rounded-2xl border border-dark-3 bg-dark-2 p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
