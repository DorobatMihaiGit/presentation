import type { Locale } from "@/i18n/routing";

// Shapes mirror the spec §4 data model (base table + `<entity>_i18n` rows).
// M2 replaces the fixture source with Drizzle queries that return these same
// record types, so components never change.

/** Stack layer enum; each value maps to one physical layer of the 3D monolith. */
export const STACK_LAYERS = [
  "interface",
  "api",
  "data",
  "infra",
  "craft",
] as const;
export type StackLayer = (typeof STACK_LAYERS)[number];

/** `YYYY-MM`, e.g. `2021-03`. */
export type YearMonth = `${number}-${number}`;

export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "freelance";

/** Per-locale translatable columns. English is required; other locales may be partial. */
export type I18n<T> = { en: T } & {
  [L in Exclude<Locale, "en">]?: Partial<T>;
};

/** A resolved translatable value plus the locale it actually came from. */
export type Localized<T> = { value: T; lang: Locale };

export type SocialLink = { network: "github" | "linkedin"; url: string };

export type ProfileRecord = {
  emailPublic: string;
  location: string;
  countryCode: string;
  socials: SocialLink[];
  available: boolean;
  yearsExp: number;
  i18n: I18n<{
    fullName: string;
    headline: string;
    summary: string;
    seoTitle: string;
    seoDescription: string;
  }>;
};

export type ExperienceRecord = {
  id: string;
  company: string;
  url?: string;
  startDate: YearMonth;
  endDate: YearMonth | null;
  employmentType: EmploymentType;
  sortOrder: number;
  isPublished: boolean;
  i18n: I18n<{ roleTitle: string; description: string; highlights: string[] }>;
};

export type SkillCategoryRecord = {
  slug: string;
  layer: StackLayer;
  i18n: I18n<{ name: string }>;
};

export type SkillRecord = {
  slug: string;
  categorySlug: string;
  name: string;
  level: 1 | 2 | 3 | 4 | 5;
  years: number;
  featured: boolean;
};

export type ProjectRecord = {
  slug: string;
  repoUrl?: string;
  liveUrl?: string;
  year: number;
  featured: boolean;
  published: boolean;
  skills: string[];
  i18n: I18n<{ title: string; summary: string; role: string; outcome: string }>;
};

export type CvRecords = {
  profile: ProfileRecord;
  experience: ExperienceRecord[];
  skillCategories: SkillCategoryRecord[];
  skills: SkillRecord[];
  projects: ProjectRecord[];
};

/** Resolved, locale-specific view model consumed by the section components. */
export type Cv = {
  locale: Locale;
  profile: {
    fullName: Localized<string>;
    headline: Localized<string>;
    summary: Localized<string>;
    seoTitle: Localized<string>;
    seoDescription: Localized<string>;
    email: string;
    location: string;
    countryCode: string;
    socials: SocialLink[];
    available: boolean;
    yearsExp: number;
  };
  experience: Array<{
    id: string;
    company: string;
    url?: string;
    startDate: YearMonth;
    endDate: YearMonth | null;
    employmentType: EmploymentType;
    roleTitle: Localized<string>;
    description: Localized<string>;
    highlights: Localized<string[]>;
  }>;
  stack: Array<{
    layer: StackLayer;
    name: Localized<string>;
    skills: Array<{ slug: string; name: string; featured: boolean }>;
  }>;
  projects: Array<{
    slug: string;
    repoUrl?: string;
    liveUrl?: string;
    year: number;
    featured: boolean;
    skills: string[];
    title: Localized<string>;
    summary: Localized<string>;
    role: Localized<string>;
    outcome: Localized<string>;
  }>;
};
