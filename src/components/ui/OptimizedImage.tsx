import {
  getImgProps,
  type ImageProps,
} from "next/dist/shared/lib/get-img-props";
import type { ImageConfigComplete } from "next/dist/shared/lib/image-config";
import defaultLoader from "next/dist/shared/lib/image-loader";
import { preload } from "react-dom";

/**
 * next/image's `getImageProps()`, minus its import of next/image's client
 * component: importing anything from "next/image" makes the page ship that
 * component (5.5 KB gz on /en), even when only the server calls it. The
 * image options are the ones `next build` inlines for next/image itself.
 */
export function optimizedImageProps(props: ImageProps) {
  const { props: image } = getImgProps(props, {
    defaultLoader,
    imgConf: process.env.__NEXT_IMAGE_OPTS as unknown as ImageConfigComplete,
  });
  return image;
}

/**
 * A plain <img> with next/image's resized `srcset`, rendered on the server.
 * No blur placeholder (it would never be removed; callers put the LQIP
 * behind the image). `preload` also adds a <link rel="preload"> to <head>.
 */
export function OptimizedImage(
  props: Omit<ImageProps, "placeholder" | "blurDataURL">,
) {
  const image = optimizedImageProps(props);
  if (props.preload) {
    preload(image.src, {
      as: "image",
      imageSrcSet: image.srcSet,
      imageSizes: image.sizes,
      fetchPriority: "high",
    });
  }
  return (
    // biome-ignore lint/performance/noImgElement: next/image's srcset without its client component (see above).
    <img
      {...image}
      alt={image.alt}
      fetchPriority={props.preload ? "high" : image.fetchPriority}
    />
  );
}
