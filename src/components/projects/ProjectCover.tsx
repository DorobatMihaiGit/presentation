import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { fallbackLang } from "@/content/localize";
import type { MediaImage } from "@/content/types";
import type { Locale } from "@/i18n/routing";

/**
 * A project's cover from the media library, resized by next/image (the
 * uploads can be up to 4 MB; next.config.ts allows `/api/media/**` only).
 * Always a 16:10 frame, so the grid card and the project page crop alike;
 * the upload's tiny blurred preview shows behind it while it loads.
 */
export function ProjectCover({
  cover,
  locale,
  sizes,
  preload = false,
}: {
  cover: MediaImage;
  locale: Locale;
  sizes: string;
  /** The page's LCP image: preloaded, never lazy. */
  preload?: boolean;
}) {
  return (
    <div
      className="relative aspect-[16/10] overflow-hidden bg-raised bg-cover bg-center"
      style={cover.lqip ? { backgroundImage: `url(${cover.lqip})` } : undefined}
    >
      <OptimizedImage
        src={cover.url}
        alt={cover.alt.value}
        lang={fallbackLang(cover.alt, locale)}
        fill
        sizes={sizes}
        preload={preload}
        className="object-cover"
      />
    </div>
  );
}
