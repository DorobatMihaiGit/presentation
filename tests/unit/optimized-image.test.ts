import { describe, expect, it } from "vitest";
import { optimizedImageProps } from "@/components/ui/OptimizedImage";

describe("optimizedImageProps", () => {
  // Deep imports of next's image internals: this fails first if a Next
  // upgrade moves them.
  it("points a media library upload at the image optimizer", () => {
    const image = optimizedImageProps({
      src: "/api/media/0b4c3f7e-2c1a-4f6e-9d55-5b7c6f1e2a90.webp",
      alt: "Headshot",
      width: 112,
      height: 112,
      sizes: "56px",
    });

    expect(image.src).toMatch(
      /^\/_next\/image\?url=%2Fapi%2Fmedia%2F0b4c3f7e-2c1a-4f6e-9d55-5b7c6f1e2a90\.webp&w=\d+&q=75$/,
    );
    expect(image.srcSet?.split(", ").length).toBeGreaterThan(3);
    expect(image.loading).toBe("lazy");
  });

  it("loads a preloaded image at once", () => {
    const image = optimizedImageProps({
      src: "/api/media/0b4c3f7e-2c1a-4f6e-9d55-5b7c6f1e2a90.webp",
      alt: "",
      fill: true,
      sizes: "100vw",
      preload: true,
    });

    expect(image.loading).toBeUndefined();
    expect(image.style).toMatchObject({ position: "absolute", width: "100%" });
  });
});
