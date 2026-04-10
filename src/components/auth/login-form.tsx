import { loginFormAction } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  error?: string;
}

export function LoginForm({ error }: Props) {
  return (
    <form action={loginFormAction} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Input
        id="email"
        name="email"
        type="email"
        label="Email"
        placeholder="contabil@firma.ro"
        required
        autoComplete="email"
        autoFocus
        className="py-3"
      />

      <Input
        id="password"
        name="password"
        type="password"
        label="Parola"
        placeholder="Introdu parola"
        required
        autoComplete="current-password"
        className="py-3"
      />

      <Button type="submit" className="w-full py-3">
        Autentificare
      </Button>
    </form>
  );
}
