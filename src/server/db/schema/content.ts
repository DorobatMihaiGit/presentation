import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { type SocialLink, STACK_LAYERS } from "@/content/types";
import { user } from "./auth";

// Spec §4: every translatable entity is a base table plus an `<entity>_i18n`
// table keyed by (id, locale). Translatable text columns are NOT NULL with an
// empty-string default: a blank value means "not translated" and falls back
// to English when the CV is resolved (see src/content/localize.ts).

const YEAR_MONTH = "^[0-9]{4}-(0[1-9]|1[0-2])$";

export const localeEnum = pgEnum("locale", ["en", "ro"]);
export const stackLayerEnum = pgEnum("stack_layer", STACK_LAYERS);
export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "contract",
  "freelance",
]);
export const mediaKindEnum = pgEnum("media_kind", ["image", "document"]);
export const messageStatusEnum = pgEnum("message_status", [
  "new",
  "read",
  "archived",
  "spam",
]);
export const emailStatusEnum = pgEnum("email_status", ["sent", "failed"]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Public URL: a Vercel Blob URL, or `/api/media/<key>` for local storage. */
  blobUrl: text("blob_url").notNull(),
  /** Storage key used to delete the object. */
  pathname: text("pathname").notNull().unique(),
  kind: mediaKindEnum("kind").notNull(),
  mime: text("mime").notNull(),
  width: integer("width"),
  height: integer("height"),
  bytes: integer("bytes").notNull(),
  /** Tiny blurred WebP data URL shown while the image loads. */
  lqip: text("lqip"),
  altEn: text("alt_en").notNull().default(""),
  altRo: text("alt_ro").notNull().default(""),
  createdAt: createdAt(),
});

export const profile = pgTable(
  "profile",
  {
    id: smallint("id").primaryKey().default(1),
    emailPublic: text("email_public").notNull(),
    location: text("location").notNull(),
    countryCode: text("country_code").notNull(),
    avatarMediaId: uuid("avatar_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    socials: jsonb("socials").$type<SocialLink[]>().notNull().default([]),
    available: boolean("available").notNull().default(true),
    yearsExp: smallint("years_exp").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("profile_singleton", sql`${t.id} = 1`),
    check("profile_country_code", sql`${t.countryCode} ~ '^[A-Z]{2}$'`),
    check("profile_years_exp", sql`${t.yearsExp} between 0 and 80`),
  ],
);

export const profileI18n = pgTable(
  "profile_i18n",
  {
    profileId: smallint("profile_id")
      .notNull()
      .references(() => profile.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    fullName: text("full_name").notNull().default(""),
    headline: text("headline").notNull().default(""),
    summaryMd: text("summary_md").notNull().default(""),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    cvPdfMediaId: uuid("cv_pdf_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.locale] })],
);

export const experience = pgTable(
  "experience",
  {
    id: text("id").primaryKey(),
    company: text("company").notNull(),
    url: text("url"),
    logoMediaId: uuid("logo_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    employmentType: employmentTypeEnum("employment_type").notNull(),
    sortOrder: integer("sort_order").notNull(),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "experience_start_date",
      sql`${t.startDate} ~ '${sql.raw(YEAR_MONTH)}'`,
    ),
    check(
      "experience_end_date",
      sql`${t.endDate} is null or (${t.endDate} ~ '${sql.raw(YEAR_MONTH)}' and ${t.endDate} >= ${t.startDate})`,
    ),
    index("experience_sort_order_idx").on(t.sortOrder),
  ],
);

export const experienceI18n = pgTable(
  "experience_i18n",
  {
    experienceId: text("experience_id")
      .notNull()
      .references(() => experience.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    roleTitle: text("role_title").notNull().default(""),
    descriptionMd: text("description_md").notNull().default(""),
    highlights: text("highlights").array().notNull().default(sql`'{}'`),
  },
  (t) => [primaryKey({ columns: [t.experienceId, t.locale] })],
);

export const skillCategory = pgTable("skill_category", {
  slug: text("slug").primaryKey(),
  /** One category per physical layer of the 3D stack. */
  layer: stackLayerEnum("layer").notNull().unique(),
});

export const skillCategoryI18n = pgTable(
  "skill_category_i18n",
  {
    categorySlug: text("category_slug")
      .notNull()
      .references(() => skillCategory.slug, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    name: text("name").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.categorySlug, t.locale] })],
);

export const skill = pgTable(
  "skill",
  {
    slug: text("slug").primaryKey(),
    categorySlug: text("category_slug")
      .notNull()
      .references(() => skillCategory.slug, { onDelete: "restrict" }),
    name: text("name").notNull(),
    level: smallint("level").notNull(),
    years: smallint("years").notNull(),
    featured: boolean("featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [
    check("skill_level", sql`${t.level} between 1 and 5`),
    check("skill_years", sql`${t.years} between 0 and 80`),
    index("skill_category_idx").on(t.categorySlug, t.sortOrder),
  ],
);

export const project = pgTable(
  "project",
  {
    slug: text("slug").primaryKey(),
    repoUrl: text("repo_url"),
    liveUrl: text("live_url"),
    coverMediaId: uuid("cover_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    videoMediaId: uuid("video_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    year: smallint("year").notNull(),
    featured: boolean("featured").notNull().default(false),
    published: boolean("published").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("project_year", sql`${t.year} between 1990 and 2100`)],
);

export const projectI18n = pgTable(
  "project_i18n",
  {
    projectSlug: text("project_slug")
      .notNull()
      .references(() => project.slug, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    title: text("title").notNull().default(""),
    summary: text("summary").notNull().default(""),
    bodyMd: text("body_md").notNull().default(""),
    role: text("role").notNull().default(""),
    outcome: text("outcome").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.projectSlug, t.locale] })],
);

export const projectSkill = pgTable(
  "project_skill",
  {
    projectSlug: text("project_slug")
      .notNull()
      .references(() => project.slug, { onDelete: "cascade" }),
    skillSlug: text("skill_slug")
      .notNull()
      .references(() => skill.slug, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectSlug, t.skillSlug] })],
);

export const experienceSkill = pgTable(
  "experience_skill",
  {
    experienceId: text("experience_id")
      .notNull()
      .references(() => experience.id, { onDelete: "cascade" }),
    skillSlug: text("skill_slug")
      .notNull()
      .references(() => skill.slug, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.experienceId, t.skillSlug] })],
);

/** Contact messages. Created now so M3 only adds the action and the inbox. */
export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company"),
    body: text("body").notNull(),
    locale: localeEnum("locale").notNull(),
    ipHash: text("ip_hash").notNull(),
    status: messageStatusEnum("status").notNull().default("new"),
    emailStatus: emailStatusEnum("email_status"),
    createdAt: createdAt(),
  },
  (t) => [index("message_ip_hash_created_idx").on(t.ipHash, t.createdAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    diff: jsonb("diff").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt)],
);
