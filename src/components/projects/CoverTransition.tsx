import { type ReactNode, ViewTransition } from "react";

/**
 * The project's cover is one object in the grid card and on the project
 * page: the same name on both sides makes it morph between them.
 */
export function CoverTransition({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  return (
    <ViewTransition name={`project-cover-${slug}`} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
