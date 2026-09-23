import { Martian_Mono, Mona_Sans } from "next/font/google";

// Two variable fonts, latin + latin-ext (Romanian ș ț ă live in latin-ext).
// Only the wght axis is requested: the wdth axis more than doubles the files.
export const sans = Mona_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-mona-sans",
  display: "swap",
});

// Labels only (dates, layer codes), never the LCP text, so it is not preloaded.
export const mono = Martian_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-martian-mono",
  display: "swap",
  preload: false,
});
