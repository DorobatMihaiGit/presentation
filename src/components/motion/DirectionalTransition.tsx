import { type ReactNode, ViewTransition } from "react";

/**
 * Page-level View Transition for the list ↔ detail navigations: links tag
 * their navigation `nav-forward` (into a project, to the next one) or
 * `nav-back` (back to the grid, to the previous one), and the page slides
 * accordingly (globals.css). Any other navigation, a browser back included,
 * swaps the page without animating it.
 */
export function DirectionalTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "none",
      }}
      exit={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "none",
      }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
