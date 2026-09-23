import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { About } from "@/components/sections/About";
import { Contact } from "@/components/sections/Contact";
import { Experience } from "@/components/sections/Experience";
import { Hero } from "@/components/sections/Hero";
import { Projects } from "@/components/sections/Projects";
import { Skills } from "@/components/sections/Skills";
import { getCv } from "@/content/get-cv";
import {
  languageAlternates,
  localeUrl,
  personJsonLd,
  serializeJsonLd,
} from "@/lib/seo";
import { siteUrl } from "@/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { profile } = await getCv(locale);
  const url = localeUrl(siteUrl, locale);

  return {
    alternates: { canonical: url, languages: languageAlternates(siteUrl) },
    openGraph: {
      type: "profile",
      url,
      siteName: profile.fullName.value,
      title: profile.seoTitle.value,
      description: profile.seoDescription.value,
      locale: locale === "ro" ? "ro_RO" : "en_US",
    },
  };
}

export default async function HomePage() {
  const cv = await getCv(await getLocale());

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: serializeJsonLd escapes "<", so content cannot close the tag.
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(personJsonLd(cv, siteUrl)),
        }}
      />
      <Hero cv={cv} />
      <About cv={cv} />
      <Skills cv={cv} />
      <Experience cv={cv} />
      <Projects cv={cv} />
      <Contact cv={cv} />
    </>
  );
}
