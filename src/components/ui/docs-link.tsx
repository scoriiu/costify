import Link from "next/link";

/**
 * Inline "Afla mai mult" link to a documentation page. Opens the in-app docs
 * viewer in a new tab so the user can read without losing the current screen
 * context (mapping flow, owner home, etc).
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
  const isExternal = /^https?:\/\//i.test(href);

  return (
    <Link
      href={href}
      target="_blank"
      rel={isExternal ? "noopener noreferrer" : undefined}
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
