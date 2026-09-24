"use server";

import { eq } from "drizzle-orm";
import type { SocialLink } from "@/content/types";
import type { ActionResult } from "@/server/admin/action-result";
import { notFound, runAdminAction } from "@/server/admin/run-action";
import { profileInput } from "@/server/admin/schemas/profile";
import { profile, profileI18n } from "@/server/db/schema";

export async function saveProfile(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    profileInput,
    async (input, { db, audit }) => {
      const socials: SocialLink[] = [];
      if (input.github) {
        socials.push({ network: "github", url: input.github });
      }
      if (input.linkedin) {
        socials.push({ network: "linkedin", url: input.linkedin });
      }

      const updated = await db
        .update(profile)
        .set({
          emailPublic: input.emailPublic,
          location: input.location,
          countryCode: input.countryCode,
          yearsExp: input.yearsExp,
          available: input.available,
          socials,
          avatarMediaId: input.avatarMediaId,
        })
        .where(eq(profile.id, 1))
        .returning({ id: profile.id });
      if (updated.length === 0) {
        return notFound("The profile is missing. Run `pnpm db:seed`.");
      }

      for (const locale of ["en", "ro"] as const) {
        const t = input[locale];
        const row = {
          fullName: t.fullName,
          headline: t.headline,
          summaryMd: t.summary,
          seoTitle: t.seoTitle,
          seoDescription: t.seoDescription,
          cvPdfMediaId: t.cvPdfMediaId,
        };
        await db
          .insert(profileI18n)
          .values({ profileId: 1, locale, ...row })
          .onConflictDoUpdate({
            target: [profileI18n.profileId, profileI18n.locale],
            set: row,
          });
      }

      await audit({
        action: "update",
        entity: "profile",
        entityId: "1",
        diff: input,
      });
      return { status: "ok", message: "Profile saved." };
    },
  );
}
