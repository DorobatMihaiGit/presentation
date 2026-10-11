import { afterEach, describe, expect, it } from "vitest";
import { formatFileSize, formatYearMonth } from "@/lib/format";

describe("formatYearMonth", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("formats English short months", () => {
    expect(formatYearMonth("2021-03", "en")).toBe("Mar 2021");
  });

  it("formats Romanian short months", () => {
    expect(formatYearMonth("2019-09", "ro")).toBe("sept. 2019");
  });

  it("keeps the month when the server runs west of UTC", () => {
    process.env.TZ = "Pacific/Honolulu";

    expect(formatYearMonth("2021-03", "en")).toBe("Mar 2021");
  });
});

describe("formatFileSize", () => {
  it("shows kilobytes without decimals", () => {
    expect(formatFileSize(91_000, "en")).toBe("89 kB");
  });

  it("switches to megabytes with one decimal, per locale", () => {
    expect(formatFileSize(1_500_000, "en")).toBe("1.4 MB");
    expect(formatFileSize(1_500_000, "ro")).toBe("1,4 MB");
  });
});
