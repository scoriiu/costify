import Link from "next/link";

/**
 * Inline "Afla mai mult" link to a documentation page. Always opens in a new
 * tab so the user doesn't lose context. Used inside tooltips, helper text
 * and section descriptions across the Mapari Cashflow flow.
 */
export function DocsLink({
  href,
  children = "Afla mai mult",
  className,
}: {
  href: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "inline-flex items-center gap-0.5 text-primary hover:text-primary-light underline-offset-2 hover:underline"
      }
      style={{ letterSpacing: "-0.02em" }}
    >
      {children}
      <span aria-hidden>&nbsp;→</span>
    </Link>
  );
}
