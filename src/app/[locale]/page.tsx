import { getLocale } from "next-intl/server";
import { About } from "@/components/sections/About";
import { Contact } from "@/components/sections/Contact";
import { Experience } from "@/components/sections/Experience";
import { Hero } from "@/components/sections/Hero";
import { Projects } from "@/components/sections/Projects";
import { Skills } from "@/components/sections/Skills";
import { getCv } from "@/content/get-cv";

export default async function HomePage() {
  const cv = await getCv(await getLocale());

  return (
    <>
      <Hero cv={cv} />
      <About cv={cv} />
      <Skills cv={cv} />
      <Experience cv={cv} />
      <Projects cv={cv} />
      <Contact cv={cv} />
    </>
  );
}
