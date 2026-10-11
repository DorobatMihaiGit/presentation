import Markdown from "react-markdown";

/**
 * A project's case study, written in markdown in the admin. Raw HTML is
 * dropped (`skipHtml`), react-markdown's default URL filter keeps only
 * http(s), mailto and relative links, and images are left out: the cover is
 * the project's image. The page's h1 is the project title, so a `#` heading
 * renders as h2.
 */
export function CaseStudy({ markdown }: { markdown: string }) {
  return (
    <div className="case-study">
      <Markdown skipHtml disallowedElements={["img"]} components={{ h1: "h2" }}>
        {markdown}
      </Markdown>
    </div>
  );
}
