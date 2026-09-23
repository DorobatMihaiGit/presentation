import "./globals.css";

// Rendered when the [locale] segment itself is invalid (e.g. /missing.txt,
// which the proxy matcher skips), so no localized layout exists.
export default function RootNotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          Page not found
        </h1>
      </body>
    </html>
  );
}
