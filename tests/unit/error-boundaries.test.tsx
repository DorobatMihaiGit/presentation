// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LocaleError from "@/app/[locale]/error";
import AdminError from "@/app/admin/error";
import GlobalError from "@/app/global-error";
import { StageErrorBoundary } from "@/experience/StageErrorBoundary";
import { errorCopy } from "@/lib/error-copy";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";

let pathname = "/en";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

afterEach(cleanup);

describe("the page error boundary", () => {
  it.each([
    ["en", en, "Something went wrong", "Try again"],
    ["ro", ro, "Ceva nu a mers", "Încearcă din nou"],
  ] as const)("speaks %s and retries", (locale, messages, title, retry) => {
    const onRetry = vi.fn();
    pathname = `/${locale}/projects/ledger-lens`;
    render(<LocaleError retry={onRetry} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(title);
    expect(
      screen
        .getByRole("link", { name: messages.Error.home })
        .getAttribute("href"),
    ).toBe(`/${locale}`);
    fireEvent.click(screen.getByRole("button", { name: retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("the admin error boundary", () => {
  it("links back to the admin and retries", () => {
    const onRetry = vi.fn();
    render(<AdminError retry={onRetry} />);
    expect(
      screen
        .getByRole("link", { name: "Back to the admin" })
        .getAttribute("href"),
    ).toBe("/admin");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("the global error page", () => {
  it("keeps its copy in sync with messages/*.json", () => {
    expect(errorCopy("/en").copy).toEqual(en.Error);
    expect(errorCopy("/ro/projects/x").copy).toEqual(ro.Error);
  });

  it("picks the language from the path", () => {
    expect(errorCopy("/ro").lang).toBe("ro");
    expect(errorCopy("/robots").lang).toBe("en");
    expect(errorCopy("/admin").lang).toBe("en");
  });

  it("renders the copy and retries", () => {
    const onRetry = vi.fn();
    // It renders its own <html>; React warns about the nesting in jsdom only.
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<GlobalError retry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: en.Error.home }).getAttribute("href"),
    ).toBe("/en");
  });
});

describe("the stage error boundary", () => {
  function Broken(): never {
    throw new Error("shader did not compile");
  }

  it("falls back to the posters when the stage throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();
    const { container } = render(
      <StageErrorBoundary onError={onError}>
        <Broken />
      </StageErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "shader did not compile" }),
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the stage while it works", () => {
    const onError = vi.fn();
    render(
      <StageErrorBoundary onError={onError}>
        <p>stage</p>
      </StageErrorBoundary>,
    );
    expect(screen.getByText("stage")).toBeTruthy();
    expect(onError).not.toHaveBeenCalled();
  });
});
