/**
 * Builders for OwnerContext (plain data) and pageHref helper.
 *
 * Context is plain data only (no functions) so it can cross the server→client
 * boundary safely. pageHref is a pure helper computed from context.
 *
 * URL strategy:
 *   - For owners:  /firma/[page]      (slug implicit from session)
 *   - For preview: /clients/[slug]?view=owner&page=[page]
 */

import type { OwnerContext, OwnerPageKey } from "./owner-layout";

interface BuildArgs {
  clientId: string;
  clientName: string;
  slug: string;
  activePage: OwnerPageKey;
}

export function buildOwnerContextForFirma(args: BuildArgs): OwnerContext {
  return {
    clientId: args.clientId,
    clientName: args.clientName,
    slug: args.slug,
    isPreview: false,
    baseHref: "/firma",
    activePage: args.activePage,
  };
}

export function buildOwnerContextForPreview(args: BuildArgs): OwnerContext {
  return {
    clientId: args.clientId,
    clientName: args.clientName,
    slug: args.slug,
    isPreview: true,
    baseHref: `/clients/${args.slug}?view=owner`,
    activePage: args.activePage,
  };
}

/**
 * Pure helper. Given context + a page slug ("bani", "clienti", "" for home),
 * returns the absolute URL to navigate to.
 */
export function buildPageHref(context: OwnerContext, pageSlug: string): string {
  if (context.isPreview) {
    return pageSlug ? `${context.baseHref}&page=${pageSlug}` : context.baseHref;
  }
  return pageSlug ? `${context.baseHref}/${pageSlug}` : context.baseHref;
}
