/**
 * Internal-user gating.
 *
 * The `/internal/*` routes (design system, marketing, mascot debug, firma
 * showcase) are not for tenants — they're for the Costify team. Membership
 * is driven by `NEXT_PUBLIC_INTERNAL_USER_EMAILS` (comma-separated) so it
 * works in both server components (route guards) and client components
 * (nav rendering) without prop-drilling.
 *
 * Why `NEXT_PUBLIC_*`: client components can't read server-only env vars at
 * runtime. The list of emails is not a secret (anyone with access to the
 * bundle can read it), it's a UI affordance — actual security comes from
 * the server-side `redirect` inside each `/internal/*` page guard.
 *
 * If the env var is unset we fail closed: no one is internal. Use this in
 * `.env`/`.env.local`:
 *
 *   NEXT_PUBLIC_INTERNAL_USER_EMAILS=foo@costify.ro,bar@costify.ro
 */

const RAW = process.env.NEXT_PUBLIC_INTERNAL_USER_EMAILS ?? "";

const EMAILS: ReadonlySet<string> = new Set(
  RAW.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
);

export function isInternalUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAILS.has(email.toLowerCase());
}
