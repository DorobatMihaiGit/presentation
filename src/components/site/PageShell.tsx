import type { ReactNode } from "react";
import type { Cv } from "@/content/types";
import { SiteHeader } from "./SiteHeader";

/**
 * The header and <main> of a page. Pages render it themselves (not the
 * locale layout) so the header knows which page it sits on without reading
 * the URL at runtime: the HTML stays fully static.
 */
export function PageShell({
  cv,
  path,
  children,
}: {
  cv: Cv;
  /** See SiteHeader: "/" for the home page, null for a 404. */
  path: string | null;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader cv={cv} path={path} />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
    </>
  );
}
